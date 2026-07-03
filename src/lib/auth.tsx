import * as React from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from './firebase'
import type { UserProfile } from './types'

const MAX_PASSWORD_ATTEMPTS = 3
const ATTEMPTS_KEY = 'promarwadi-login-attempts'

function readAttempts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeAttempts(map: Record<string, number>) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(map))
}

export function attemptsFor(email: string) {
  return readAttempts()[email.trim().toLowerCase()] ?? 0
}

export function otpRequiredFor(email: string) {
  return attemptsFor(email) >= MAX_PASSWORD_ATTEMPTS
}

export function clearAttempts(email?: string) {
  if (!email) {
    localStorage.removeItem(ATTEMPTS_KEY)
    return
  }
  const map = readAttempts()
  delete map[email.trim().toLowerCase()]
  writeAttempts(map)
}

function bumpAttempts(email: string) {
  const key = email.trim().toLowerCase()
  const map = readAttempts()
  map[key] = (map[key] ?? 0) + 1
  writeAttempts(map)
  return map[key]
}

export type AuthStatus = 'loading' | 'signedOut' | 'noProfile' | 'ready'

type AuthStore = {
  /* 'cloud' when Firebase is configured, 'demo' for local-only mode */
  mode: 'cloud' | 'demo'
  status: AuthStatus
  user: User | null
  profile: UserProfile | null
  signInEmail: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; attemptsLeft: number; otpRequired: boolean }>
  signOutUser: () => Promise<void>
}

const AuthContext = React.createContext<AuthStore | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [status, setStatus] = React.useState<AuthStatus>(isFirebaseConfigured ? 'loading' : 'ready')
  const [profile, setProfile] = React.useState<UserProfile | null>(null)

  React.useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      if (!next) {
        setProfile(null)
        setStatus('signedOut')
      } else {
        setStatus('loading')
      }
    })
  }, [])

  // Live profile: role changes (or account removal) apply without re-login
  React.useEffect(() => {
    if (!db || !user) return
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile)
          setStatus('ready')
        } else {
          setProfile(null)
          setStatus('noProfile')
        }
      },
      () => {
        setProfile(null)
        setStatus('noProfile')
      },
    )
  }, [user])

  const signInEmail = React.useCallback(
    async (email: string, password: string) => {
      if (!auth) return { ok: false, attemptsLeft: 0, otpRequired: false }
      if (otpRequiredFor(email)) return { ok: false, attemptsLeft: 0, otpRequired: true }
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        clearAttempts(email)
        return { ok: true, attemptsLeft: MAX_PASSWORD_ATTEMPTS, otpRequired: false }
      } catch {
        const attempts = bumpAttempts(email)
        const left = Math.max(0, MAX_PASSWORD_ATTEMPTS - attempts)
        return { ok: false, attemptsLeft: left, otpRequired: left === 0 }
      }
    },
    [],
  )

  const signOutUser = React.useCallback(async () => {
    if (auth) await signOut(auth)
  }, [])

  const store: AuthStore = {
    mode: isFirebaseConfigured ? 'cloud' : 'demo',
    status,
    user,
    profile,
    signInEmail,
    signOutUser,
  }

  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const store = React.useContext(AuthContext)
  if (!store) throw new Error('useAuth must be used inside AuthProvider')
  return store
}
