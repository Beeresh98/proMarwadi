import * as React from 'react'
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import {
  CloudUpload,
  Database,
  FileJson,
  FileSpreadsheet,
  Info,
  KeyRound,
  Languages,
  LogOut,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/form'
import { SegmentedControl } from '../components/ui/picker'
import { useAuth } from '../lib/auth'
import { auth as firebaseAuth } from '../lib/firebase'
import { downloadFile, toCsv } from '../lib/ledger'
import { useApp } from '../lib/store'
import { normalizePhone } from './login'
import type { Language, UserRole } from '../lib/types'

function LinkPhoneCard() {
  const { t } = useApp()
  const { user } = useAuth()
  const [phone, setPhone] = React.useState('')
  const [otp, setOtp] = React.useState('')
  const [confirmation, setConfirmation] = React.useState<ConfirmationResult | null>(null)
  const [state, setState] = React.useState<'idle' | 'error' | 'done'>('idle')
  const [busy, setBusy] = React.useState(false)
  const verifierRef = React.useRef<RecaptchaVerifier | null>(null)

  React.useEffect(() => {
    return () => {
      verifierRef.current?.clear()
      verifierRef.current = null
    }
  }, [])

  if (user?.phoneNumber) {
    return (
      <p className="flex items-center gap-2 text-sm text-secondary-text">
        <Phone className="h-4 w-4 shrink-0 text-primary" />
        {t('linkedPhone')}: <span className="tnum font-medium text-foreground">{user.phoneNumber}</span>
      </p>
    )
  }

  async function sendLinkOtp() {
    if (!firebaseAuth?.currentUser || !phone.trim() || busy) return
    setBusy(true)
    setState('idle')
    try {
      verifierRef.current?.clear()
      verifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container-settings', {
        size: 'invisible',
      })
      const result = await linkWithPhoneNumber(
        firebaseAuth.currentUser,
        normalizePhone(phone),
        verifierRef.current,
      )
      setConfirmation(result)
    } catch {
      setState('error')
      verifierRef.current?.clear()
      verifierRef.current = null
    } finally {
      setBusy(false)
    }
  }

  async function confirmLink() {
    if (!confirmation || otp.trim().length < 6 || busy) return
    setBusy(true)
    setState('idle')
    try {
      await confirmation.confirm(otp.trim())
      setState('done')
      setConfirmation(null)
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2.5">
      <p className="text-xs text-muted-foreground">{t('phoneLinkHint')}</p>
      {!confirmation ? (
        <div className="flex gap-2.5">
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+91 98765 43210"
            className="flex-1"
          />
          <Button variant="secondary" disabled={!phone.trim() || busy} onClick={sendLinkOtp} className="shrink-0">
            <Phone className="h-4 w-4" />
            {t('sendOtp')}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2.5 animate-fade-up">
          <Input
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="tnum flex-1 tracking-[0.3em]"
          />
          <Button variant="secondary" disabled={otp.trim().length < 6 || busy} onClick={confirmLink} className="shrink-0">
            <KeyRound className="h-4 w-4" />
            {t('enterOtp')}
          </Button>
        </div>
      )}
      {state === 'error' && <p className="text-xs text-debit animate-fade-in">{t('otpSendFailed')}</p>}
      {state === 'done' && <p className="text-xs text-credit animate-fade-in">{t('phoneLinked')}</p>}
      <div id="recaptcha-container-settings" />
    </div>
  )
}

export function SettingsScreen() {
  const { t, language, setLanguage, role, setRole, isAdmin, isCloud, customers, entries, importLocalToCloud } =
    useApp()
  const { mode, user, signOutUser } = useAuth()
  const [imported, setImported] = React.useState<number | null>(null)
  const [importing, setImporting] = React.useState(false)

  return (
    <div className="space-y-4 animate-fade-up">
      {mode === 'cloud' && (
        <section className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
            <UserRound className="h-4 w-4" />
            {t('account')}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{user?.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded bg-primary-tint px-1.5 py-px font-medium text-primary-pressed">
                  <ShieldCheck className="h-3 w-3" />
                  {isAdmin ? t('admin') : t('staff')}
                </span>
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void signOutUser()} className="shrink-0">
              <LogOut className="h-4 w-4" />
              {t('signOut')}
            </Button>
          </div>
          <LinkPhoneCard />
        </section>
      )}

      <section className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4">
        <div className="grid gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
            <Languages className="h-4 w-4" />
            {t('language')}
          </p>
          <SegmentedControl<Language>
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'हिंदी' },
            ]}
          />
        </div>
        {mode === 'demo' && (
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
              <ShieldCheck className="h-4 w-4" />
              {t('role')}
            </p>
            <SegmentedControl<UserRole>
              value={role}
              onChange={setRole}
              options={[
                { value: 'admin', label: t('admin') },
                { value: 'staff', label: t('staff') },
              ]}
            />
            {!isAdmin && <p className="text-xs text-muted-foreground animate-fade-in">{t('staffRestriction')}</p>}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="grid gap-2.5 rounded-[var(--radius-card)] border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
            <Database className="h-4 w-4" />
            {t('backups')}
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              downloadFile(
                'promarwadi-backup.json',
                JSON.stringify({ customers, entries, exportedAt: new Date().toISOString() }, null, 2),
                'application/json',
              )
            }
          >
            <FileJson className="h-4 w-4" />
            {t('exportJson')}
          </Button>
          <Button variant="secondary" onClick={() => downloadFile('promarwadi-customers.csv', toCsv(customers), 'text/csv')}>
            <FileSpreadsheet className="h-4 w-4" />
            {t('exportCustomersCsv')}
          </Button>
          <Button variant="secondary" onClick={() => downloadFile('promarwadi-ledger.csv', toCsv(entries), 'text/csv')}>
            <FileSpreadsheet className="h-4 w-4" />
            {t('exportLedgerCsv')}
          </Button>
          {isCloud && (
            <>
              <Button
                variant="secondary"
                disabled={importing}
                onClick={async () => {
                  setImporting(true)
                  const count = await importLocalToCloud()
                  setImported(count)
                  setImporting(false)
                }}
              >
                <CloudUpload className="h-4 w-4" />
                {t('importToCloud')}
              </Button>
              {imported !== null && (
                <p className="tnum text-xs text-credit animate-fade-in">
                  {t('importDone')} ({imported})
                </p>
              )}
            </>
          )}
        </section>
      )}

      <p className="flex items-start gap-2 rounded-[var(--radius-card)] bg-muted p-3.5 text-xs text-secondary-text">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        {isCloud ? t('cloudNote') : t('demoNote')}
      </p>
    </div>
  )
}
