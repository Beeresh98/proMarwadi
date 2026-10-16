import * as React from 'react'
import { doc, getDocFromServer } from 'firebase/firestore'
import { RefreshCw, WifiOff } from 'lucide-react'
import { db, isFirebaseConfigured } from '../../lib/firebase'
import { Button } from '../ui/button'

/* Remote kill switch. Flip `live` to false on the Firestore document
   meta/appStatus (Firebase console) and, the next time anyone opens the app,
   they get a long spinner and then what looks like an ordinary connection
   failure — nothing hints that the app was switched off on purpose.

   Fail-open: if the status can't be read (offline, timeout, rules) the app
   loads normally, so a real network blip never locks anyone out. The one
   exception is a device that has already seen the switch off — it stays
   "offline" until a status read succeeds and says live again. */

const STATUS_TIMEOUT_MS = 6000
const SPINNER_MS = 15000
const RETRY_SPINNER_MS = 4000
const OFF_KEY = 'promarwadi-svc-off'
const LANGUAGE_KEY = 'promarwadi-language'

type Phase = 'checking' | 'live' | 'spinner' | 'error'
type Verdict = 'live' | 'off' | 'unknown'

const copy = {
  en: {
    title: 'No connection',
    body: 'Could not reach the server. Check your internet and try again.',
    retry: 'Try again',
  },
  hi: {
    title: 'कनेक्शन नहीं मिला',
    body: 'सर्वर से जुड़ नहीं पाए। इंटरनेट चेक करके दोबारा कोशिश करें।',
    retry: 'फिर से कोशिश करें',
  },
}

function storedLanguage(): 'en' | 'hi' {
  try {
    return JSON.parse(localStorage.getItem(LANGUAGE_KEY) ?? '"en"') === 'hi' ? 'hi' : 'en'
  } catch {
    return 'en'
  }
}

function wasOff() {
  try {
    return localStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

function remember(off: boolean) {
  try {
    if (off) localStorage.setItem(OFF_KEY, '1')
    else localStorage.removeItem(OFF_KEY)
  } catch {
    // storage unavailable — the gate still works, just without the offline memory
  }
}

async function readVerdict(): Promise<Verdict> {
  if (!isFirebaseConfigured || !db) return 'live'
  try {
    const snapshot = await Promise.race([
      getDocFromServer(doc(db, 'meta', 'appStatus')),
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), STATUS_TIMEOUT_MS)),
    ])
    // a missing document or field means "on" — only an explicit false switches off
    return snapshot.exists() && snapshot.data().live === false ? 'off' : 'live'
  } catch {
    return 'unknown'
  }
}

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-hero text-[22px] font-semibold text-hero-foreground">
        ₹
      </div>
    </div>
  )
}

export function ServiceGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = React.useState<Phase>('checking')
  const timer = React.useRef(0)

  const check = React.useCallback(async (spinnerMs: number) => {
    const verdict = await readVerdict()
    const blocked = verdict === 'off' || (verdict === 'unknown' && wasOff())
    if (verdict !== 'unknown') remember(blocked)
    window.clearTimeout(timer.current)
    if (!blocked) {
      setPhase('live')
      return
    }
    setPhase('spinner')
    timer.current = window.setTimeout(() => setPhase('error'), spinnerMs)
  }, [])

  React.useEffect(() => {
    void check(SPINNER_MS)
    return () => window.clearTimeout(timer.current)
  }, [check])

  if (phase === 'live') return <>{children}</>
  if (phase !== 'error') return <Spinner />

  const text = copy[storedLanguage()]
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-card p-6 text-center animate-fade-up">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{text.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{text.body}</p>
        <Button
          className="mt-5 w-full"
          onClick={() => {
            setPhase('spinner')
            void check(RETRY_SPINNER_MS)
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {text.retry}
        </Button>
      </div>
    </div>
  )
}
