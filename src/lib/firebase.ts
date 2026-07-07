import { deleteApp, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

/* Web app config identifies the project; it ships in the bundle and is not a
   secret — data protection comes from Firestore security rules. Env vars can
   override (e.g. to point a fork at another project). */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDh7YtvK1CgsgYvRkB9MFRAaNg3IVJlxWg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'promarwadi-63230.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'promarwadi-63230',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'promarwadi-63230.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '669783766857',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:669783766857:web:8ecf2141f970bcb7f8cc98',
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

/* getFirestore(app) with no second argument always requests the database ID
   "(default)" (reserved, with parentheses). This project's Firestore database
   was created with the literal ID "default" (no parens) instead, so the SDK
   could never find it — every read/write failed as "Database not found",
   regardless of rules or caching. Confirmed via the console URL
   (.../databases/default/...; the true reserved default shows as -default-). */
const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'default'

/* Local Firebase emulator mode (never touches production data). Run the app
   with `npm run dev:emu` — it loads .env.emulator, which flips this on and
   swaps the project id to demo-promarwadi so nothing can reach the cloud. */
export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp
  ? firestoreDatabaseId
    ? getFirestore(firebaseApp, firestoreDatabaseId)
    : getFirestore(firebaseApp)
  : null

if (useEmulators && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/* Creates a Firebase Auth account for a staff member WITHOUT touching the
   admin's session: createUserWithEmailAndPassword signs the new user in on
   whatever auth instance it runs on, so we run it on a throwaway secondary
   app and tear it down immediately. Returns the new uid. */
export async function createAuthAccount(email: string, password: string): Promise<string> {
  if (!isFirebaseConfigured) throw new Error('cloud-only')
  const secondary = initializeApp(firebaseConfig, `account-factory-${Date.now()}`)
  try {
    const secondaryAuth = getAuth(secondary)
    if (useEmulators) connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password)
      return credential.user.uid
    } catch (error) {
      // a previous attempt may have created the login but failed before the
      // profile was written — if the credentials match, adopt that account
      if ((error as { code?: string })?.code !== 'auth/email-already-in-use') throw error
      const credential = await signInWithEmailAndPassword(secondaryAuth, email.trim(), password).catch(() => {
        throw error
      })
      return credential.user.uid
    } finally {
      await signOut(secondaryAuth).catch(() => {})
    }
  } finally {
    void deleteApp(secondary).catch(() => {})
  }
}
