import * as React from 'react'
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import {
  CalendarDays,
  Check,
  ChevronDown,
  CloudUpload,
  Database,
  FileJson,
  FileSpreadsheet,
  Home,
  Info,
  KeyRound,
  Landmark,
  Languages,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Save,
  Star,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { RouteMembersSheet } from '../components/app/route-members-sheet'
import { Button } from '../components/ui/button'
import { formatDisplayDate } from '../components/ui/date-picker'
import { Field, Input } from '../components/ui/form'
import { SegmentedControl } from '../components/ui/picker'
import { ConfirmDialog, Sheet } from '../components/ui/sheet'
import { useAuth } from '../lib/auth'
import { auth as firebaseAuth } from '../lib/firebase'
import { downloadFile, toCsv, today } from '../lib/ledger'
import { useApp } from '../lib/store'
import { cn } from '../lib/utils'
import { normalizePhone } from './login'
import {
  staffTypes,
  type DateFormatPref,
  type Language,
  type LandingPagePref,
  type PaymentAccountType,
  type StaffAccount,
  type StaffType,
  type UserRole,
} from '../lib/types'

/* Collapsible settings card: header is always visible, body folds away so the
   page stays scannable. Sheets/dialogs inside are position:fixed, so they
   escape the overflow-hidden fold without issue. */
function SettingsCard({
  icon: Icon,
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="pressable flex w-full items-center gap-1.5 p-4 text-left"
      >
        <Icon className="h-4 w-4 shrink-0 text-secondary-text" />
        <span className="flex-1 text-[13px] font-medium text-secondary-text">{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="grid gap-3 px-4 pb-4">
            {hint && <p className="-mt-1.5 text-xs text-muted-foreground">{hint}</p>}
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

/* Own display name — saved to users/{uid}.name; rules allow exactly this one
   field on your own profile, so it works for admin and staff alike. */
function OwnNameField() {
  const { t, updateOwnName } = useApp()
  const { profile } = useAuth()
  const saved = profile?.name ?? ''
  const [name, setName] = React.useState(saved)
  React.useEffect(() => setName(saved), [saved])
  const dirty = name.trim() !== '' && name.trim() !== saved
  return (
    <Field label={t('yourName')}>
      <div className="flex gap-2.5">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && dirty && updateOwnName(name)}
          placeholder={t('yourName')}
          className="flex-1"
        />
        <Button variant="secondary" disabled={!dirty} onClick={() => updateOwnName(name)} className="shrink-0">
          <Save className="h-4 w-4" />
          {t('save')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('yourNameHint')}</p>
    </Field>
  )
}

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

function RoutesSection() {
  const { t, routes, customers, addRoute, updateRoute, deleteRoute, routeName } = useApp()
  const [name, setName] = React.useState('')
  const [editingId, setEditingId] = React.useState('')
  const [editName, setEditName] = React.useState('')
  const [deleteId, setDeleteId] = React.useState('')
  const [membersRouteId, setMembersRouteId] = React.useState('')

  function submitNew() {
    if (!name.trim()) return
    addRoute(name)
    setName('')
  }

  function submitEdit() {
    if (!editName.trim()) return
    updateRoute(editingId, editName)
    setEditingId('')
  }

  return (
    <SettingsCard icon={MapPin} title={t('routes')} hint={t('routesHint')}>
      {routes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted-foreground">
          {t('noRoutesYet')}
        </p>
      ) : (
        <div className="stagger grid">
          {routes.map((route) => {
            const count = customers.filter((customer) => customer.routeId === route.id).length
            return (
              <div key={route.id} className="flex items-center gap-1.5 border-b border-border py-2 last:border-b-0">
                {editingId === route.id ? (
                  <div className="flex flex-1 items-center gap-1.5 animate-fade-up">
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && submitEdit()}
                      className="h-10 flex-1"
                    />
                    <Button
                      size="iconSm"
                      variant="ghost"
                      aria-label={t('save')}
                      disabled={!editName.trim()}
                      onClick={submitEdit}
                      className="shrink-0 text-credit"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{route.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? t('customerWord') : t('customersWord')}
                      </p>
                    </div>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      aria-label={`${t('manageRouteCustomers')}: ${route.name}`}
                      title={t('manageRouteCustomers')}
                      onClick={() => setMembersRouteId(route.id)}
                      className="shrink-0"
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      aria-label={`${t('save')} ${route.name}`}
                      onClick={() => {
                        setEditingId(route.id)
                        setEditName(route.name)
                      }}
                      className="shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      aria-label={`${t('delete')} ${route.name}`}
                      onClick={() => setDeleteId(route.id)}
                      className="shrink-0 hover:text-debit"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-2.5">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submitNew()}
          placeholder={t('typeRouteName')}
          className="flex-1"
        />
        <Button variant="secondary" disabled={!name.trim()} onClick={submitNew} className="shrink-0">
          <Plus className="h-4 w-4" />
          {t('addRoute')}
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        message={t('confirmDeleteRoute')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          deleteRoute(deleteId)
          setDeleteId('')
        }}
        onCancel={() => setDeleteId('')}
      />
      <RouteMembersSheet
        open={Boolean(membersRouteId)}
        routeId={membersRouteId}
        routeLabel={routeName(membersRouteId)}
        onClose={() => setMembersRouteId('')}
      />
    </SettingsCard>
  )
}

function BanksSection() {
  const { t, paymentAccounts, addPaymentAccount, deletePaymentAccount, setDefaultPaymentAccount } = useApp()
  const [type, setType] = React.useState<PaymentAccountType>('bank')
  const [name, setName] = React.useState('')
  const [detail, setDetail] = React.useState('')
  const [deleteId, setDeleteId] = React.useState('')

  function submitNew() {
    if (!name.trim()) return
    addPaymentAccount({ type, name, detail })
    setName('')
    setDetail('')
  }

  return (
    <SettingsCard icon={Landmark} title={t('banksUpi')} hint={t('banksUpiHint')}>
      {paymentAccounts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted-foreground">
          {t('noAccountsYet')}
        </p>
      ) : (
        <div className="stagger grid">
          {paymentAccounts.map((account) => (
            <div key={account.id} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary-pressed">
                {account.type === 'bank' ? <Landmark className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{account.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {account.type === 'bank' ? t('bank') : t('upi')}
                  {account.detail && ` · ${account.detail}`}
                </p>
              </div>
              {account.isDefault ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary-tint px-1.5 py-px text-xs font-medium text-primary-pressed">
                  <Star className="h-3 w-3 fill-current" />
                  {t('default')}
                </span>
              ) : (
                <Button
                  size="iconSm"
                  variant="ghost"
                  aria-label={`${t('setDefault')}: ${account.name}`}
                  title={t('setDefault')}
                  onClick={() => setDefaultPaymentAccount(account.id)}
                  className="shrink-0"
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="iconSm"
                variant="ghost"
                aria-label={`${t('delete')} ${account.name}`}
                onClick={() => setDeleteId(account.id)}
                className="shrink-0 hover:text-debit"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2.5">
        <SegmentedControl<PaymentAccountType>
          value={type}
          onChange={setType}
          options={[
            { value: 'bank', label: t('bank') },
            { value: 'upi', label: t('upi') },
          ]}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={type === 'bank' ? 'SBI, HDFC…' : 'GPay, PhonePe…'}
          />
          <Input
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submitNew()}
            placeholder={type === 'bank' ? t('bankDetailHint') : t('upiDetailHint')}
          />
        </div>
        <Button variant="secondary" disabled={!name.trim()} onClick={submitNew}>
          <Plus className="h-4 w-4" />
          {t('addAccount')}
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        message={t('confirmDeleteAccount')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          deletePaymentAccount(deleteId)
          setDeleteId('')
        }}
        onCancel={() => setDeleteId('')}
      />
    </SettingsCard>
  )
}

const emptyStaffForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  staffType: 'collection' as StaffType,
  allowedRouteIds: [] as string[],
}

function StaffSheet({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: StaffAccount | null
  onClose: () => void
}) {
  const { t, routes, addStaff, updateStaff, deleteStaff } = useApp()
  const [form, setForm] = React.useState(emptyStaffForm)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  // editing an existing account can't change its sign-in email directly — this
  // reveals a new-email/new-password pair and swaps the login on submit
  const [changingEmail, setChangingEmail] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setError('')
    setChangingEmail(false)
    setForm(
      editing
        ? {
            name: editing.name ?? '',
            email: '',
            password: '',
            phone: editing.phone ?? '',
            staffType: editing.staffType ?? 'collection',
            allowedRouteIds: editing.allowedRouteIds ?? [],
          }
        : emptyStaffForm,
    )
  }, [open, editing])

  // a login is only (re)created for a brand-new account, or when swapping the email
  const needsCredentials = !editing || changingEmail
  const valid = Boolean(
    form.name.trim() && (!needsCredentials || (form.email.trim() && form.password.length >= 6)),
  )

  function toggleRoute(id: string) {
    setForm((current) => ({
      ...current,
      allowedRouteIds: current.allowedRouteIds.includes(id)
        ? current.allowedRouteIds.filter((routeId) => routeId !== id)
        : [...current.allowedRouteIds, id],
    }))
  }

  async function submit() {
    if (!valid || busy) return
    const input = {
      name: form.name,
      phone: form.phone,
      staffType: form.staffType,
      allowedRouteIds: form.allowedRouteIds,
    }
    if (editing && !changingEmail) {
      updateStaff(editing.uid, input)
      onClose()
      return
    }
    setBusy(true)
    setError('')
    try {
      // for a real email change: create the replacement login first, then
      // remove the old one — never leave the account with zero logins
      await addStaff(form.email, form.password, input)
      if (editing) deleteStaff(editing.uid)
      onClose()
    } catch (err) {
      console.error('addStaff failed', err)
      const code = (err as { code?: string })?.code ?? ''
      setError(
        code === 'auth/email-already-in-use'
          ? t('emailInUse')
          : code === 'auth/weak-password'
            ? t('weakPassword')
            : code === 'auth/invalid-email'
              ? t('invalidEmail')
              : t('createStaffFailed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title={editing ? t('editStaff') : t('addStaff')} onClose={onClose}>
      <div className="grid gap-4 pt-1">
        <Field label={t('name')}>
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label={t('phone')}>
          <Input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
        {editing && !changingEmail && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-input px-3.5 py-3">
            <p className="min-w-0 truncate text-sm text-secondary-text">
              {t('email')}: <span className="font-medium text-foreground">{editing.email}</span>
            </p>
            <button
              type="button"
              onClick={() => setChangingEmail(true)}
              className="pressable shrink-0 text-xs font-medium text-primary hover:underline"
            >
              {t('changeEmail')}
            </button>
          </div>
        )}
        {(!editing || changingEmail) && (
          <div className="grid gap-3 animate-fade-up">
            {editing && <p className="text-xs text-muted-foreground">{t('changeEmailHint')}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label={editing ? t('newEmail') : t('email')}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </Field>
              <Field label={editing ? t('newPassword') : t('password')}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="••••••"
                />
              </Field>
            </div>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setChangingEmail(false)
                  setForm((current) => ({ ...current, email: '', password: '' }))
                }}
                className="pressable justify-self-start text-xs font-medium text-secondary-text hover:underline"
              >
                {t('cancelChangeEmail')}
              </button>
            )}
          </div>
        )}
        <Field label={t('staffType')}>
          <SegmentedControl<StaffType>
            value={form.staffType}
            onChange={(staffType) => setForm({ ...form, staffType })}
            options={staffTypes.map((value) => ({ value, label: t('staffTypeCollection') }))}
          />
        </Field>
        <Field label={t('allocatedRoutes')}>
          <div className="grid gap-1 rounded-[var(--radius-control)] border border-input p-1.5">
            {routes.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">{t('noRoutesYet')}</p>
            ) : (
              routes.map((route) => {
                const selected = form.allowedRouteIds.includes(route.id)
                return (
                  <button
                    key={route.id}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggleRoute(route.id)}
                    className={cn(
                      'pressable flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[15px] hover:bg-fill',
                      selected && 'bg-primary-tint font-medium text-primary-pressed',
                    )}
                  >
                    {route.name}
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })
            )}
          </div>
          {form.allowedRouteIds.length === 0 && (
            <p className="text-xs text-debit animate-fade-in">{t('noRoutesAllocatedWarning')}</p>
          )}
        </Field>
        {error && <p className="text-xs text-debit animate-fade-in">{error}</p>}
        <Button disabled={!valid || busy} onClick={submit} className="mt-1">
          <Save className="h-4 w-4" />
          {t('save')}
        </Button>
      </div>
    </Sheet>
  )
}

function StaffSection() {
  const { t, staffAccounts, deleteStaff, routeName } = useApp()
  const [sheet, setSheet] = React.useState<{ open: boolean; editing: StaffAccount | null }>({
    open: false,
    editing: null,
  })
  const [deleteId, setDeleteId] = React.useState('')

  return (
    <SettingsCard icon={Users} title={t('staffAccounts')} hint={t('staffAccountsHint')}>
      {staffAccounts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted-foreground">
          {t('noStaffYet')}
        </p>
      ) : (
        <div className="stagger grid">
          {staffAccounts.map((account) => {
            const routeNames = (account.allowedRouteIds ?? []).map(routeName).filter(Boolean)
            return (
              <div key={account.uid} className="flex items-center gap-1.5 border-b border-border py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{account.name || account.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('staffTypeCollection')} ·{' '}
                    {routeNames.length > 0 ? routeNames.join(', ') : t('noRoute')}
                  </p>
                </div>
                <Button
                  size="iconSm"
                  variant="ghost"
                  aria-label={`${t('editStaff')}: ${account.name ?? account.email}`}
                  onClick={() => setSheet({ open: true, editing: account })}
                  className="shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  aria-label={`${t('delete')}: ${account.name ?? account.email}`}
                  onClick={() => setDeleteId(account.uid)}
                  className="shrink-0 hover:text-debit"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Button variant="secondary" onClick={() => setSheet({ open: true, editing: null })}>
        <Plus className="h-4 w-4" />
        {t('addStaff')}
      </Button>

      <ConfirmDialog
        open={Boolean(deleteId)}
        message={t('confirmDeleteStaff')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          deleteStaff(deleteId)
          setDeleteId('')
        }}
        onCancel={() => setDeleteId('')}
      />
      <StaffSheet
        open={sheet.open}
        editing={sheet.editing}
        onClose={() => setSheet({ open: false, editing: null })}
      />
    </SettingsCard>
  )
}

/* Staff-facing: read-only list of the routes allocated to this account.
   `routes` and `customers` from the store are already scoped for staff. */
function YourRoutesSection() {
  const { t, routes, customers } = useApp()
  return (
    <SettingsCard icon={MapPin} title={t('yourRoutes')} defaultOpen>
      {routes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-muted-foreground">
          {t('noRoutesAllocatedWarning')}
        </p>
      ) : (
        <div className="stagger grid">
          {routes.map((route) => {
            const count = customers.filter((customer) => customer.routeId === route.id).length
            return (
              <div key={route.id} className="flex items-baseline justify-between gap-2 border-b border-border py-2 last:border-b-0">
                <p className="truncate text-[15px] font-medium">{route.name}</p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {count} {count === 1 ? t('customerWord') : t('customersWord')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </SettingsCard>
  )
}

function PreferencesSection() {
  const { t, language, preferences, setPreferences } = useApp()

  return (
    <SettingsCard icon={SlidersHorizontal} title={t('preferences')}>
      <div className="grid gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
          <CalendarDays className="h-4 w-4" />
          {t('dateFormat')}
        </p>
        <SegmentedControl<DateFormatPref>
          value={preferences.dateFormat}
          onChange={(dateFormat) => setPreferences({ dateFormat })}
          options={[
            { value: 'ddmmyyyy', label: <span className="tnum">{formatDisplayDate(today, language, 'ddmmyyyy')}</span> },
            { value: 'ddMMMyyyy', label: <span className="tnum">{formatDisplayDate(today, language, 'ddMMMyyyy')}</span> },
          ]}
        />
      </div>
      <div className="grid gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
          <Home className="h-4 w-4" />
          {t('landingPage')}
        </p>
        <SegmentedControl<LandingPagePref>
          value={preferences.landingPage}
          onChange={(landingPage) => setPreferences({ landingPage })}
          options={[
            { value: 'highestBalance', label: t('landingHighestBalance') },
            { value: 'lastEntries', label: t('landingLastEntries') },
          ]}
        />
      </div>
      <div className="grid gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-text">
          <FileSpreadsheet className="h-4 w-4" />
          {t('csvBulkEntry')}
        </p>
        <p className="text-xs text-muted-foreground">{t('csvBulkEntryHint')}</p>
        <SegmentedControl<'on' | 'off'>
          value={preferences.csvImportEnabled ? 'on' : 'off'}
          onChange={(next) => setPreferences({ csvImportEnabled: next === 'on' })}
          options={[
            { value: 'on', label: t('on') },
            { value: 'off', label: t('off') },
          ]}
        />
      </div>
    </SettingsCard>
  )
}

export function SettingsScreen() {
  const { t, language, setLanguage, role, setRole, isAdmin, isCloud, customers, entries, importLocalToCloud } =
    useApp()
  const { mode, user, profile, signOutUser } = useAuth()
  const [imported, setImported] = React.useState<number | null>(null)
  const [importing, setImporting] = React.useState(false)

  return (
    <div className="space-y-4 animate-fade-up">
      {mode === 'cloud' && (
        <SettingsCard icon={UserRound} title={t('account')} defaultOpen>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{profile?.name || user?.email}</p>
              {profile?.name && <p className="truncate text-xs text-muted-foreground">{user?.email}</p>}
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
          <OwnNameField />
          <LinkPhoneCard />
        </SettingsCard>
      )}

      <SettingsCard icon={Languages} title={t('language')}>
        <SegmentedControl<Language>
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिंदी' },
          ]}
        />
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
      </SettingsCard>

      {isAdmin && (
        <>
          <RoutesSection />
          {isCloud && <StaffSection />}
          <BanksSection />
          <PreferencesSection />
        </>
      )}

      {!isAdmin && isCloud && <YourRoutesSection />}

      {isAdmin && (
        <SettingsCard icon={Database} title={t('backups')}>
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
        </SettingsCard>
      )}

      <p className="flex items-start gap-2 rounded-[var(--radius-card)] bg-muted p-3.5 text-xs text-secondary-text">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        {isCloud ? t('cloudNote') : t('demoNote')}
      </p>
    </div>
  )
}
