import * as React from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { defaultAccountFor, toEntryInput } from '../components/app/entry-sheet'
import { Avatar, Balance } from '../components/app/money'
import { Button } from '../components/ui/button'
import { DatePicker, formatDisplayDate } from '../components/ui/date-picker'
import { Field, Input } from '../components/ui/form'
import { Picker, type PickerOption } from '../components/ui/picker'
import { customerBalance, ledgerRows, today } from '../lib/ledger'
import { useApp } from '../lib/store'
import type { Customer, EntryType, LedgerEntry, PaymentMode } from '../lib/types'
import { cn } from '../lib/utils'

/* One entry waiting in the batch. Bill and Received typed together become
   two items, the same way a CSV row with both BILL and CASH does. */
type Item = {
  key: string
  customerId: string
  date: string
  type: EntryType
  amount: number
  note: string
  /* Encoded "mode|accountName" so one compact Picker covers cash/bank/UPI. */
  payment: string
}

type BatchSummary = {
  count: number
  at: number
  rows: Array<{ customerId: string; before: number; after: number }>
}

const allTime = { from: '0000-01-01', to: '9999-12-31' }
const historyLimit = { side: 8, inline: 5 }

function encodePayment(mode: PaymentMode, name = '') {
  return `${mode}|${name}`
}

function decodePayment(value: string) {
  const split = value.indexOf('|')
  const mode = value.slice(0, split) as PaymentMode
  const name = value.slice(split + 1)
  return { paymentMode: mode, bankName: mode === 'bank' ? name : '', upiApp: mode === 'upi' ? name : '' }
}

let itemSeq = 0
function nextKey() {
  itemSeq += 1
  return `item-${itemSeq}`
}

/* Local-calendar day arithmetic on 'YYYY-MM-DD', never past today (every
   DatePicker in the app blocks future dates). */
function shiftDay(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const next = new Date(year, month - 1, day + days)
  const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  return iso > today ? today : iso
}

/* Unsaved items dressed as ledger entries so the real running-balance math
   (ledgerRows / customerBalance) can place them among saved history. The
   '~' createdAt sorts after every ISO timestamp, so on a shared date they
   land after saved entries, in the order they were added. */
function asLedgerEntries(items: Item[]): LedgerEntry[] {
  return [...items].reverse().map((item, index) => ({
    id: item.key,
    customerId: item.customerId,
    date: item.date,
    type: item.type,
    amount: item.amount,
    note: item.note,
    ...(item.type === 'credit' ? decodePayment(item.payment) : {}),
    createdAt: `~${String(index).padStart(5, '0')}`,
    createdBy: '',
    isEdited: false,
    editCount: 0,
  }))
}

function isTextField(target: EventTarget | null) {
  if (target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && target.type !== 'number'
}

/* No modes: one composer whose date and customer stay filled after each Add.
   Same day / many customers → change only the customer; one customer / many
   days → change only the date (Alt+↓); mixed → change both. */
export function BulkEntryScreen({
  initialCustomerId = '',
  onBack,
  onDirtyChange,
  onOpenLedger,
}: {
  initialCustomerId?: string
  onBack: () => void
  /* Count of entries that would be lost — App asks before discarding them. */
  onDirtyChange: (count: number) => void
  onOpenLedger: (customerId: string) => void
}) {
  const { t, fmt, language, preferences, customers, entries, paymentAccounts, addEntries, defaultPaymentMode } =
    useApp()

  // Cash plus every configured account; Bank/UPI with no accounts set up are
  // simply not offered (a bank payment needs a bank name to be valid).
  const paymentOptions: PickerOption[] = [
    { value: encodePayment('cash'), label: t('cash') },
    ...paymentAccounts.map((account) => ({
      value: encodePayment(account.type, account.name),
      label: account.name,
      hint: account.type === 'bank' ? t('bank') : t('upi'),
    })),
  ]
  const defaultPayment = (() => {
    const account = defaultAccountFor(paymentAccounts, defaultPaymentMode)
    return account ? encodePayment(account.type, account.name) : encodePayment('cash')
  })()
  const paymentLabel = (value: string) => {
    const { paymentMode, bankName, upiApp } = decodePayment(value)
    return paymentMode === 'cash' ? t('cash') : bankName || upiApp
  }

  const customerOptions: PickerOption[] = [...customers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((customer) => ({ value: customer.id, label: customer.name, hint: `${customer.city} · ${customer.district}` }))

  // composer — date, customer and payment stay put between entries
  const [date, setDate] = React.useState(today)
  const [dateBump, setDateBump] = React.useState(0)
  const [customerId, setCustomerId] = React.useState(initialCustomerId)
  const [payment, setPayment] = React.useState(defaultPayment)
  const [bill, setBill] = React.useState('')
  const [received, setReceived] = React.useState('')
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState('')

  const [items, setItems] = React.useState<Item[]>([])
  const [flashKey, setFlashKey] = React.useState('')
  const [summary, setSummary] = React.useState<BatchSummary | null>(null)
  const billRef = React.useRef<HTMLInputElement>(null)
  const receivedRef = React.useRef<HTMLInputElement>(null)
  const customerWrapRef = React.useRef<HTMLDivElement>(null)

  const hasPending = bill.trim() !== '' || received.trim() !== ''

  // Typed-but-not-added amounts count too, so Save never silently drops the
  // last line someone forgot to Add.
  function buildPending(): { items: Item[]; error: string } {
    if (!hasPending) return { items: [], error: '' }
    const billAmount = Number(bill)
    const receivedAmount = Number(received)
    if ((bill.trim() && !(billAmount > 0)) || (received.trim() && !(receivedAmount > 0)))
      return { items: [], error: t('bulkNeedAmount') }
    if (!customerId) return { items: [], error: t('bulkNeedCustomer') }
    const base = { customerId, date, note: note.trim(), payment }
    const next: Item[] = []
    if (billAmount > 0) next.push({ ...base, key: nextKey(), type: 'debit', amount: billAmount })
    if (receivedAmount > 0) next.push({ ...base, key: nextKey(), type: 'credit', amount: receivedAmount })
    return { items: next, error: '' }
  }

  const pendingValid = buildPending().items
  // newest first, matching the Added list
  const all = [...[...pendingValid].reverse(), ...items]
  const totals = all.reduce(
    (sum, item) =>
      item.type === 'debit' ? { ...sum, bill: sum.bill + item.amount } : { ...sum, received: sum.received + item.amount },
    { bill: 0, received: 0 },
  )
  const dirtyCount = items.length + (hasPending ? Math.max(1, pendingValid.length) : 0)

  // per-customer balance before → after this batch, in first-touched order
  const batchCustomerIds = [...new Set([...all].reverse().map((item) => item.customerId))]
  const projections = batchCustomerIds.flatMap((id) => {
    const customer = customers.find((item) => item.id === id)
    if (!customer) return []
    const before = customerBalance(customer, entries)
    const after = customerBalance(customer, [...entries, ...asLedgerEntries(all.filter((item) => item.customerId === id))])
    return [{ customer, before, after }]
  })

  React.useEffect(() => {
    onDirtyChange(dirtyCount)
  }, [dirtyCount, onDirtyChange])

  function clearAmounts() {
    setBill('')
    setReceived('')
    setNote('')
    setError('')
  }

  function changeCustomer(next: string) {
    setCustomerId(next)
    setError('')
    // picking a customer means the next thing typed is an amount; wait for the
    // dropdown to unmount (it takes focus with it) before moving the cursor
    window.setTimeout(() => billRef.current?.focus(), 0)
  }

  function openCustomerSearch() {
    const trigger = customerWrapRef.current?.querySelector('button')
    if (trigger && trigger.getAttribute('aria-expanded') !== 'true') trigger.click()
  }

  function add() {
    const pending = buildPending()
    if (!hasPending) {
      setError(t('bulkNeedAmount'))
      billRef.current?.focus()
      return
    }
    if (pending.error) {
      setError(pending.error)
      return
    }
    setItems((current) => [...[...pending.items].reverse(), ...current])
    setFlashKey(pending.items[0]?.key ?? '')
    setSummary(null)
    // keep typing in whichever column was just used
    const refocus = bill.trim() ? billRef : receivedRef
    clearAmounts()
    refocus.current?.focus()
  }

  function onEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    add()
  }

  // tapping an added line pulls it back into the composer to fix it
  function editItem(item: Item) {
    if (hasPending) {
      setError(t('bulkFinishCurrent'))
      return
    }
    setItems((current) => current.filter((entry) => entry.key !== item.key))
    setCustomerId(item.customerId)
    setDate(item.date)
    setNote(item.note)
    setPayment(item.payment)
    setError('')
    if (item.type === 'debit') {
      setBill(String(item.amount))
      billRef.current?.focus()
    } else {
      setReceived(String(item.amount))
      receivedRef.current?.focus()
    }
  }

  function save() {
    const pending = buildPending()
    if (pending.error) {
      setError(pending.error)
      return
    }
    const batch = [...items, ...pending.items]
    if (batch.length === 0) return
    addEntries(
      batch.map((item) =>
        toEntryInput({
          customerId: item.customerId,
          date: item.date,
          type: item.type,
          amount: item.amount,
          note: item.note,
          ...decodePayment(item.payment),
        }),
      ),
    )
    setSummary({
      count: batch.length,
      at: Date.now(),
      rows: projections.map(({ customer, before, after }) => ({ customerId: customer.id, before, after })),
    })
    setItems([])
    clearAmounts()
    billRef.current?.focus()
  }

  // Keyboard-first flow. Handlers read the latest render through a ref so the
  // listener is attached once; capture phase lets Alt+↑/↓ beat number-input
  // stepping and Ctrl+S beat the browser's save dialog.
  const shortcuts = React.useRef({ save, openCustomerSearch, clearAmounts, setDate, hasPending })
  shortcuts.current = { save, openCustomerSearch, clearAmounts, setDate, hasPending }
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const handlers = shortcuts.current
      const mod = event.ctrlKey || event.metaKey
      let handled = true
      if (mod && (event.key === 's' || event.key === 'S' || event.key === 'Enter')) handlers.save()
      else if (mod && (event.key === 'k' || event.key === 'K')) handlers.openCustomerSearch()
      else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        handlers.setDate((current) => shiftDay(current, event.key === 'ArrowUp' ? 1 : -1))
        setDateBump((current) => current + 1)
      } else if (event.key === '/' && !mod && !isTextField(event.target)) handlers.openCustomerSearch()
      else if (
        event.key === 'Escape' &&
        handlers.hasPending &&
        // Esc first closes an open dropdown or dialog
        !document.querySelector('[data-popover], [role="alertdialog"]')
      )
        handlers.clearAmounts()
      else handled = false
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const customer = customers.find((item) => item.id === customerId)
  const customerName = (id: string) => customers.find((item) => item.id === id)?.name ?? '—'
  const customerPending = customer ? asLedgerEntries(all.filter((item) => item.customerId === customer.id)) : []

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full text-secondary-text hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-medium leading-tight">{t('bulkEntry')}</h1>
          <p className="truncate text-xs text-muted-foreground">{t('bulkStaysHint')}</p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="@container min-w-0 space-y-4">
          <section className="grid gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
            {/* customer first and full width — it's the field that changes most */}
            <Field label={t('customer')} className="min-w-0 grid-cols-1">
              <div ref={customerWrapRef}>
                <Picker
                  value={customerId}
                  onChange={changeCustomer}
                  placeholder={t('selectCustomer')}
                  searchable
                  searchPlaceholder={t('searchCustomer')}
                  options={customerOptions}
                />
              </div>
            </Field>

            {/* phone / narrow: compact history strip; desktop uses the side panel */}
            {customer && (
              <InlineHistory
                key={customer.id}
                customer={customer}
                entries={entries}
                pending={customerPending}
                paymentLabel={paymentLabel}
              />
            )}

            <div className="grid grid-cols-2 gap-2.5 @md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label={t('date')} className="col-span-2 min-w-0 grid-cols-1 @md:col-span-1">
                {/* remount on Alt+↑/↓ so the change visibly pops */}
                <div key={dateBump} className={cn(dateBump > 0 && 'animate-pop-in')}>
                  <DatePicker value={date} onChange={setDate} language={language} dateFormat={preferences.dateFormat} />
                </div>
              </Field>
              <Field label={`${t('youGave')} −`} className="min-w-0 [&>label]:text-debit">
                <AmountInput
                  ref={billRef}
                  value={bill}
                  onChange={(value) => {
                    setBill(value)
                    setError('')
                  }}
                  onKeyDown={onEnter}
                  tone="debit"
                  label={t('youGave')}
                />
              </Field>
              <Field label={`${t('youGot')} +`} className="min-w-0 [&>label]:text-credit">
                <AmountInput
                  ref={receivedRef}
                  value={received}
                  onChange={(value) => {
                    setReceived(value)
                    setError('')
                  }}
                  onKeyDown={onEnter}
                  tone="credit"
                  label={t('youGot')}
                />
              </Field>
            </div>

            <div className="grid gap-2.5 @md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] @md:items-end">
              {/* always visible so the mode is easy to find; only applies to Received */}
              <Field label={t('receivedVia')} className="min-w-0 grid-cols-1">
                <Picker value={payment} onChange={setPayment} options={paymentOptions} menuWidth={240} />
              </Field>
              <div className="flex items-end gap-2.5 @md:contents">
                <Field label={t('note')} className="min-w-0 flex-1 grid-cols-1">
                  <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    onKeyDown={onEnter}
                    placeholder="—"
                    enterKeyHint="done"
                  />
                </Field>
                <Button onClick={add} className="shrink-0 px-6">
                  <Plus className="h-4 w-4" />
                  {t('addToList')}
                </Button>
              </div>
            </div>
            {error && (
              <p key={error} className="-mt-1 text-xs text-debit animate-fade-in">
                {error}
              </p>
            )}

            {/* shortcut hints — keyboards are a desktop thing */}
            <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground lg:flex">
              {(
                [
                  ['Enter', t('kbdAdd')],
                  ['Tab', t('kbdNext')],
                  ['/', t('kbdCustomer')],
                  ['Alt ↑↓', t('kbdDate')],
                  ['Ctrl S', t('kbdSave')],
                  ['Esc', t('kbdClear')],
                ] as const
              ).map(([key, label]) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-border-strong bg-fill px-1.5 py-px font-sans text-[10px] font-medium text-secondary-text">
                    {key}
                  </kbd>
                  {label}
                </span>
              ))}
            </div>
          </section>

          {summary && (
            <BatchSummaryCard
              key={summary.at}
              summary={summary}
              customerName={customerName}
              onOpenLedger={onOpenLedger}
              onDismiss={() => setSummary(null)}
            />
          )}

          <section>
            <h2 className="mb-2 text-[13px] font-medium text-secondary-text">
              {t('addedEntries')}
              {items.length > 0 && <span className="tnum"> · {items.length}</span>}
            </h2>
            {items.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground animate-fade-in">
                {t('bulkEmpty')}
              </p>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-border bg-card px-4">
                {/* column headers line up with the desktop row grid below */}
                <div className="hidden grid-cols-[5.5rem_minmax(0,1fr)_6rem_6rem_7rem_2rem] gap-3 border-b border-border py-2 text-[11px] font-medium text-muted-foreground @lg:grid">
                  <span>{t('date')}</span>
                  <span>{t('customer')}</span>
                  <span className="text-right text-debit">{t('youGave')}</span>
                  <span className="text-right text-credit">{t('youGot')}</span>
                  <span>{t('receivedVia')}</span>
                  <span />
                </div>
                {items.map((item) => {
                  const debit = item.type === 'debit'
                  const dateLabel = formatDisplayDate(item.date, language, preferences.dateFormat)
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        'flex items-center gap-2 border-b border-border last:border-b-0',
                        item.key === flashKey ? 'flash-row' : 'animate-fade-in',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => editItem(item)}
                        className="pressable flex min-w-0 flex-1 items-center gap-3 py-3 text-left @lg:grid @lg:grid-cols-[5.5rem_minmax(0,1fr)_6rem_6rem_7rem] @lg:gap-3"
                      >
                        {/* phone: name over date · via, amount on the right */}
                        <span className="min-w-0 flex-1 @lg:hidden">
                          <span className="block truncate text-[15px] font-medium">{customerName(item.customerId)}</span>
                          <span className="tnum block truncate text-xs text-muted-foreground">
                            {dateLabel}
                            {!debit && ` · ${paymentLabel(item.payment)}`}
                            {item.note && ` · ${item.note}`}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'tnum shrink-0 text-[15px] font-medium @lg:hidden',
                            debit ? 'text-debit' : 'text-credit',
                          )}
                        >
                          {debit ? '−' : '+'}
                          {fmt(item.amount)}
                        </span>
                        {/* desktop: table cells */}
                        <span className="tnum hidden text-sm text-secondary-text @lg:block">{dateLabel}</span>
                        <span className="hidden min-w-0 @lg:block">
                          <span className="block truncate text-sm font-medium">{customerName(item.customerId)}</span>
                          {item.note && <span className="block truncate text-xs text-muted-foreground">{item.note}</span>}
                        </span>
                        <span className="tnum hidden text-right text-sm font-medium text-debit @lg:block">
                          {debit ? fmt(item.amount) : ''}
                        </span>
                        <span className="tnum hidden text-right text-sm font-medium text-credit @lg:block">
                          {debit ? '' : fmt(item.amount)}
                        </span>
                        <span className="hidden truncate text-sm text-secondary-text @lg:block">
                          {debit ? '' : paymentLabel(item.payment)}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={t('removeEntry')}
                        onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                        className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-debit-tint hover:text-debit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-background via-background via-80% to-transparent px-4 pb-2 pt-6 lg:bottom-4">
            {projections.length > 0 && (
              <div className="mb-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {projections.slice(0, 2).map(({ customer: projected, before, after }) => (
                  <span key={projected.id} className="tnum inline-flex min-w-0 items-center gap-1">
                    <span className="max-w-32 truncate text-secondary-text">{projected.name}</span>
                    {fmt(before)} →
                    <span key={after} className={cn('font-medium animate-fade-in', balanceTone(after))}>
                      {fmt(after)}
                    </span>
                  </span>
                ))}
                {projections.length > 2 && (
                  <span>{t('moreCustomers').replace('{value}', String(projections.length - 2))}</span>
                )}
              </div>
            )}
            <div className="mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[13px] text-secondary-text">
              <span className="tnum">
                {all.length} {t('entries')}
              </span>
              <span key={`b${totals.bill}`} className="tnum inline-flex items-center gap-1 text-debit animate-fade-in">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {fmt(totals.bill)}
              </span>
              <span key={`r${totals.received}`} className="tnum inline-flex items-center gap-1 text-credit animate-fade-in">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                {fmt(totals.received)}
              </span>
            </div>
            <Button
              variant={all.length > 0 ? 'primary' : 'secondary'}
              className="w-full font-semibold"
              disabled={all.length === 0}
              onClick={save}
            >
              <Check className="h-4 w-4" />
              {t('saveNEntries').replace('{value}', String(all.length))}
            </Button>
          </section>
        </div>

        <aside className="hidden lg:sticky lg:top-8 lg:block">
          {customer ? (
            <SideHistory
              key={customer.id}
              customer={customer}
              entries={entries}
              pending={customerPending}
              paymentLabel={paymentLabel}
              onOpenLedger={onOpenLedger}
            />
          ) : (
            <p className="rounded-[var(--radius-card)] border border-dashed border-border-strong px-5 py-10 text-center text-sm text-muted-foreground">
              {t('pickCustomerHistory')}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

/* Same sign convention as Balance: owes you = red, you owe = green. */
function balanceTone(amount: number) {
  return amount > 0 ? 'text-debit' : amount < 0 ? 'text-credit' : 'text-muted-foreground'
}

/* Saved history + this batch's unsaved entries for one customer, newest
   first, with the real running balance. All unsaved rows are kept; saved
   rows are capped at `limit`. */
function buildHistory(customer: Customer, entries: LedgerEntry[], pending: LedgerEntry[], limit: number) {
  const pendingIds = new Set(pending.map((entry) => entry.id))
  const merged = ledgerRows(customer, [...entries, ...pending], allTime).reverse()
  let savedShown = 0
  const rows = merged.filter((row) => {
    if (pendingIds.has(row.id)) return true
    savedShown += 1
    return savedShown <= limit
  })
  return {
    rows,
    pendingIds,
    now: customerBalance(customer, entries),
    after: customerBalance(customer, [...entries, ...pending]),
    lastSaved: merged.find((row) => !pendingIds.has(row.id)),
  }
}

function HistoryRows({
  rows,
  pendingIds,
  paymentLabel,
}: {
  rows: Array<LedgerEntry & { runningBalance: number }>
  pendingIds: Set<string>
  paymentLabel: (value: string) => string
}) {
  const { t, fmt, language, preferences } = useApp()
  if (rows.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">{t('noHistoryYet')}</p>
  }
  return (
    <div className="grid gap-1">
      {rows.map((row) => {
        const unsaved = pendingIds.has(row.id)
        const debit = row.type === 'debit'
        const via =
          !debit && row.paymentMode
            ? paymentLabel(`${row.paymentMode}|${row.bankName || row.upiApp || ''}`)
            : ''
        return (
          <div
            key={row.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5',
              unsaved ? 'border border-dashed border-primary-accent bg-primary-tint/50 animate-fade-in' : '',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className={cn('tnum text-[13px] font-medium', debit ? 'text-debit' : 'text-credit')}>
                {debit ? '−' : '+'}
                {fmt(row.amount)}
                {via && <span className="ml-1 text-[11px] font-normal text-secondary-text">{via}</span>}
              </p>
              <p className="tnum truncate text-[11px] text-muted-foreground">
                {formatDisplayDate(row.date, language, preferences.dateFormat)}
                {unsaved && (
                  <span className="ml-1 rounded bg-primary-tint px-1 py-px font-medium text-primary-pressed">
                    {t('unsavedTag')}
                  </span>
                )}
                {row.note && ` · ${row.note}`}
              </p>
            </div>
            <p className={cn('tnum shrink-0 text-[13px]', unsaved ? 'font-medium' : 'text-secondary-text')}>
              {fmt(row.runningBalance)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function AfterSaveLine({ now, after }: { now: number; after: number }) {
  const { t, fmt } = useApp()
  const delta = after - now
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2.5">
      <span className="text-[13px] font-medium text-secondary-text">{t('afterSave')}</span>
      <span className="tnum text-right">
        <span key={after} className={cn('text-[17px] font-medium animate-fade-in', balanceTone(after))}>
          {fmt(Math.abs(after))}
        </span>
        {delta !== 0 && (
          <span className={cn('ml-1.5 text-xs', delta > 0 ? 'text-debit' : 'text-credit')}>
            {delta > 0 ? '↑' : '↓'}
            {fmt(Math.abs(delta))}
          </span>
        )}
      </span>
    </div>
  )
}

/* Desktop: pinned mini-ledger beside the composer. */
function SideHistory({
  customer,
  entries,
  pending,
  paymentLabel,
  onOpenLedger,
}: {
  customer: Customer
  entries: LedgerEntry[]
  pending: LedgerEntry[]
  paymentLabel: (value: string) => string
  onOpenLedger: (customerId: string) => void
}) {
  const { t } = useApp()
  const history = buildHistory(customer, entries, pending, historyLimit.side)
  return (
    <section className="grid gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 animate-fade-in">
      <button
        type="button"
        onClick={() => onOpenLedger(customer.id)}
        className="pressable group flex items-center gap-3 text-left"
      >
        <Avatar name={customer.name} className="h-9 w-9" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{customer.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {customer.city} · {customer.district}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-border-strong transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </button>
      <div className="flex items-baseline justify-between gap-2 rounded-lg bg-fill px-3 py-2">
        <span className="text-xs text-secondary-text">{t('balanceNow')}</span>
        <Balance amount={history.now} amountClassName="text-[15px]" className="flex items-baseline gap-1.5" />
      </div>
      <div className="max-h-[calc(100dvh-20rem)] overflow-y-auto">
        <HistoryRows rows={history.rows} pendingIds={history.pendingIds} paymentLabel={paymentLabel} />
      </div>
      {pending.length > 0 && <AfterSaveLine now={history.now} after={history.after} />}
    </section>
  )
}

/* Phone / narrow: balance + last entry, tap to expand the last few. */
function InlineHistory({
  customer,
  entries,
  pending,
  paymentLabel,
}: {
  customer: Customer
  entries: LedgerEntry[]
  pending: LedgerEntry[]
  paymentLabel: (value: string) => string
}) {
  const { t, fmt, language, preferences } = useApp()
  const [open, setOpen] = React.useState(false)
  const history = buildHistory(customer, entries, pending, historyLimit.inline)
  const last = history.lastSaved
  return (
    <div className="-mt-1 rounded-lg bg-fill px-3 py-2 animate-fade-in lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="pressable flex w-full items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="tnum block truncate text-xs text-secondary-text">
            {last
              ? `${t('lastEntryLabel')}: ${formatDisplayDate(last.date, language, preferences.dateFormat)} ${last.type === 'debit' ? '−' : '+'}${fmt(last.amount)}`
              : t('noHistoryYet')}
          </span>
          {pending.length > 0 && (
            <span className="tnum block text-[11px] text-muted-foreground">
              {t('afterSave')}:{' '}
              <span key={history.after} className={cn('font-medium animate-fade-in', balanceTone(history.after))}>
                {fmt(Math.abs(history.after))}
              </span>
            </span>
          )}
        </span>
        <Balance amount={history.now} amountClassName="text-[13px]" className="flex items-baseline gap-1.5" />
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="mt-2 border-t border-border pt-2 animate-fade-up">
          <HistoryRows rows={history.rows} pendingIds={history.pendingIds} paymentLabel={paymentLabel} />
        </div>
      )}
    </div>
  )
}

/* End-of-batch check: every touched customer's balance before → after. */
function BatchSummaryCard({
  summary,
  customerName,
  onOpenLedger,
  onDismiss,
}: {
  summary: BatchSummary
  customerName: (id: string) => string
  onOpenLedger: (customerId: string) => void
  onDismiss: () => void
}) {
  const { t, fmt } = useApp()
  return (
    <section className="rounded-[var(--radius-card)] border border-credit/30 bg-card animate-fade-up">
      <div className="flex items-center gap-2 border-b border-border bg-credit-tint/60 px-4 py-2.5">
        <Check className="h-4 w-4 text-credit" />
        <p className="flex-1 text-sm font-medium text-credit">
          {t('nEntriesSaved').replace('{value}', String(summary.count))}
        </p>
        <Button size="sm" variant="ghost" className="h-8 text-credit hover:bg-credit-tint" onClick={onDismiss}>
          <Plus className="h-3.5 w-3.5" />
          {t('newBatch')}
        </Button>
      </div>
      <div className="px-4">
        {summary.rows.map((row) => (
          <button
            key={row.customerId}
            type="button"
            onClick={() => onOpenLedger(row.customerId)}
            className="pressable group flex w-full items-center gap-3 border-b border-border py-2.5 text-left last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{customerName(row.customerId)}</span>
            <span className="tnum text-xs text-muted-foreground">{fmt(Math.abs(row.before))} →</span>
            <span className={cn('tnum text-sm font-medium', balanceTone(row.after))}>{fmt(Math.abs(row.after))}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-border-strong transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
          </button>
        ))}
      </div>
    </section>
  )
}

/* ₹ amount box tinted for its column, so Bill vs Received reads at a glance. */
const AmountInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (value: string) => void
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
    tone: 'debit' | 'credit'
    label: string
  }
>(({ value, onChange, onKeyDown, tone, label }, ref) => (
  <div className="relative">
    <span
      className={cn(
        'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
        value ? (tone === 'debit' ? 'text-debit' : 'text-credit') : 'text-muted-foreground',
      )}
    >
      ₹
    </span>
    <Input
      ref={ref}
      type="number"
      inputMode="numeric"
      enterKeyHint="done"
      min={1}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder="0"
      className={cn(
        'tnum pl-8 text-[17px] font-medium',
        value &&
          (tone === 'debit'
            ? 'border-debit-strong/70 text-debit focus-visible:border-debit-strong focus-visible:ring-debit-strong/25'
            : 'border-credit/50 text-credit focus-visible:border-credit focus-visible:ring-credit/25'),
      )}
    />
  </div>
))
AmountInput.displayName = 'AmountInput'
