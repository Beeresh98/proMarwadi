import * as React from 'react'
import {
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import { KeyRound, LogIn, Phone, ShieldAlert } from 'lucide-react'
import { attemptsFor, clearAttempts, otpRequiredFor, useAuth } from '../lib/auth'
import { auth as firebaseAuth } from '../lib/firebase'
import { useApp } from '../lib/store'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/form'
import { SegmentedControl } from '../components/ui/picker'
import type { Language } from '../lib/types'

export function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  return `+91${digits}`
}

export function LoginScreen() {
  const { t, language, setLanguage } = useApp()
  const { signInEmail } = useAuth()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<'password' | 'otpSend' | 'otpVerify' | null>(null)
  const [notice, setNotice] = React.useState<'resetSent' | null>(null)
  const [attemptsLeft, setAttemptsLeft] = React.useState<number | null>(null)
  const [otpMode, setOtpMode] = React.useState(false)
  const [phone, setPhone] = React.useState('')
  const [otp, setOtp] = React.useState('')
  const [confirmation, setConfirmation] = React.useState<ConfirmationResult | null>(null)
  const [busy, setBusy] = React.useState(false)
  const verifierRef = React.useRef<RecaptchaVerifier | null>(null)

  React.useEffect(() => {
    return () => {
      verifierRef.current?.clear()
      verifierRef.current = null
    }
  }, [])

  // entering a locked-out email switches the form to OTP mode
  React.useEffect(() => {
    if (email.trim() && otpRequiredFor(email)) setOtpMode(true)
  }, [email])

  async function submitPassword() {
    if (!email.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await signInEmail(email, password)
    setBusy(false)
    if (result.ok) return
    if (result.otpRequired) {
      setOtpMode(true)
      setAttemptsLeft(0)
    } else {
      setError('password')
      setAttemptsLeft(result.attemptsLeft)
    }
  }

  async function sendOtp() {
    if (!firebaseAuth || !phone.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      verifierRef.current?.clear()
      verifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible',
      })
      const result = await signInWithPhoneNumber(firebaseAuth, normalizePhone(phone), verifierRef.current)
      setConfirmation(result)
    } catch {
      setError('otpSend')
      verifierRef.current?.clear()
      verifierRef.current = null
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp() {
    if (!confirmation || otp.trim().length < 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      await confirmation.confirm(otp.trim())
      if (email.trim()) clearAttempts(email)
    } catch {
      setError('otpVerify')
    } finally {
      setBusy(false)
    }
  }

  async function forgotPassword() {
    if (!firebaseAuth || !email.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim())
      setNotice('resetSent')
    } catch {
      setError('password')
    } finally {
      setBusy(false)
    }
  }

  const attemptsUsed = email.trim() ? attemptsFor(email) : 0

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex justify-end p-4">
        <SegmentedControl<Language>
          value={language}
          onChange={setLanguage}
          className="w-40"
          options={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिंदी' },
          ]}
        />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-16 animate-fade-up">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-hero text-[22px] font-semibold text-hero-foreground">
            ₹
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-primary-pressed">{t('appName')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('tagline')}</p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-card p-5">
          {!otpMode ? (
            <div className="grid gap-4">
              <Field label={t('email')}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
              <Field label={t('password')}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && submitPassword()}
                  placeholder="••••••••"
                />
              </Field>

              {error === 'password' && (
                <p className="flex items-center gap-1.5 text-sm text-debit animate-fade-in">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {t('signInFailed')}
                  {attemptsLeft !== null && attemptsLeft > 0 && (
                    <span className="tnum text-xs text-muted-foreground">
                      ({attemptsLeft} {t('attemptsLeft')})
                    </span>
                  )}
                </p>
              )}
              {notice === 'resetSent' && (
                <p className="text-sm text-credit animate-fade-in">{t('resetSent')}</p>
              )}

              <Button disabled={!email.trim() || !password || busy} onClick={submitPassword}>
                <LogIn className="h-4 w-4" />
                {t('signIn')}
              </Button>
              <button
                type="button"
                onClick={forgotPassword}
                className="pressable justify-self-center text-sm text-secondary-text hover:text-primary"
              >
                {t('forgotPassword')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="flex items-start gap-2 rounded-xl bg-debit-tint p-3 text-sm text-debit animate-fade-in">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {t('otpRequired')}
              </p>

              {!confirmation ? (
                <>
                  <Field label={t('phoneNumber')}>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+91 98765 43210"
                        className="pl-10"
                      />
                    </div>
                  </Field>
                  {error === 'otpSend' && (
                    <p className="text-sm text-debit animate-fade-in">{t('otpSendFailed')}</p>
                  )}
                  <Button disabled={!phone.trim() || busy} onClick={sendOtp}>
                    <Phone className="h-4 w-4" />
                    {t('sendOtp')}
                  </Button>
                </>
              ) : (
                <>
                  <Field label={t('enterOtp')}>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                        onKeyDown={(event) => event.key === 'Enter' && verifyOtp()}
                        placeholder="••••••"
                        className="tnum pl-10 text-lg tracking-[0.3em]"
                      />
                    </div>
                  </Field>
                  {error === 'otpVerify' && (
                    <p className="text-sm text-debit animate-fade-in">{t('otpFailed')}</p>
                  )}
                  <Button disabled={otp.trim().length < 6 || busy} onClick={verifyOtp}>
                    <KeyRound className="h-4 w-4" />
                    {t('verifyOtp')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {!otpMode && attemptsUsed > 0 && (
          <p className="tnum mt-3 text-center text-xs text-muted-foreground">
            {Math.max(0, 3 - attemptsUsed)} {t('attemptsLeft')}
          </p>
        )}
      </div>

      <div id="recaptcha-container" />
    </div>
  )
}
