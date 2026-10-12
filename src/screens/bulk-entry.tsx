import * as React from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, Plus, X } from 'lucide-react'
import { defaultAccountFor, toEntryInput } from '../components/app/entry-sheet'
import { Balance } from '../components/app/money'
import { Button } from '../components/ui/button'
import { DatePicker, formatDisplayDate } from '../components/ui/date-picker'
import { Field, Input } from '../components/ui/form'
import { Picker, type PickerOption } from '../components/ui/picker'
import { customerBalance, today } from '../lib/ledger'
import { useApp } from '../lib/store'
import type { EntryType, PaymentMode } from '../lib/types'
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

/* No modes: one composer whose date and customer stay filled after each Add.
   Same day / many customers → change only the customer; one customer / many
   days → change only the date; mixed → change both. */
export function BulkEntryScreen({
  initialCustomerId = '',
  onBack,
  onDirtyChange,
}: {
  initialCustomerId?: string
  onBack: () => void
  /* Count of entries that would be lost — App asks before discarding them. */
  onDirtyChange: (count: number) => void
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
  const [customerId, setCustomerId] = React.useState(initialCustomerId)
  const [payment, setPayment] = React.useState(defaultPayment)
  const [bill, setBill] = React.useState('')
  const [received, setReceived] = React.useState('')
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState('')

  const [items, setItems] = React.useState<Item[]>([])
  const [flashKey, setFlashKey] = React.useState('')
  const [saved, setSaved] = React.useState<{ count: number; at: number } | null>(null)
  const billRef = React.useRef<HTMLInputElement>(null)
  const receivedRef = React.useRef<HTMLInputElement>(null)

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
  const all = [...items, ...pendingValid]
  const totals = all.reduce(
    (sum, item) =>
      item.type === 'debit' ? { ...sum, bill: sum.bill + item.amount } : { ...sum, received: sum.received + item.amount },
    { bill: 0, received: 0 },
  )
  const dirtyCount = items.length + (hasPending ? Math.max(1, pendingValid.length) : 0)

  React.useEffect(() => {
    onDirtyChange(dirtyCount)
  }, [dirtyCount, onDirtyChange])

  React.useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(null), 4000)
    return () => window.clearTimeout(timer)
  }, [saved])

  function clearAmounts() {
    setBill('')
    setReceived('')
    setNote('')
    setError('')
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
    // newest first, so the line just added sits right under the composer
    setItems((current) => [...[...pending.items].reverse(), ...current])
    setFlashKey(pending.items[0]?.key ?? '')
    // keep typing in whichever column was just used
    const refocus = bill.trim() ? billRef : receivedRef
    clearAmounts()
    refocus.current?.focus()
  }

  function onEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
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
    setItems([])
    clearAmounts()
    setSaved({ count: batch.length, at: Date.now() })
  }

  const customer = customers.find((item) => item.id === customerId)
  const customerName = (id: string) => customers.find((item) => item.id === id)?.name ?? '—'

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

      <section className="grid gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
        <div className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] gap-2.5">
          <Field label={t('date')} className="min-w-0 grid-cols-1">
            <DatePicker value={date} onChange={setDate} language={language} dateFormat={preferences.dateFormat} />
          </Field>
          <Field label={t('customer')} className="min-w-0 grid-cols-1">
            <Picker
              value={customerId}
              onChange={(next) => {
                setCustomerId(next)
                setError('')
              }}
              placeholder={t('selectCustomer')}
              searchable
              searchPlaceholder={t('searchCustomer')}
              options={customerOptions}
              menuWidth={288}
              align="right"
            />
          </Field>
        </div>
        {customer && (
          <div key={customer.id} className="-mt-1 flex items-center justify-between gap-3 animate-fade-in">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {customer.city} · {customer.district}
            </p>
            <Balance amount={customerBalance(customer, entries)} amountClassName="text-[13px]" className="flex items-baseline gap-1.5" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Field label={`${t('youGave')} −`} className="[&>label]:text-debit">
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
          <Field label={`${t('youGot')} +`} className="[&>label]:text-credit">
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
          {/* always visible so the mode is easy to find; only applies to Received */}
          <Field label={t('receivedVia')} className="col-span-2 sm:col-span-1">
            <Picker value={payment} onChange={setPayment} options={paymentOptions} menuWidth={240} align="right" />
          </Field>
        </div>

        <div className="flex gap-2.5">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={onEnter}
            placeholder={t('note')}
            aria-label={t('note')}
            enterKeyHint="done"
            className="min-w-0 flex-1"
          />
          <Button onClick={add} className="shrink-0 px-6">
            <Plus className="h-4 w-4" />
            {t('addToList')}
          </Button>
        </div>
        {error && (
          <p key={error} className="-mt-1 text-xs text-debit animate-fade-in">
            {error}
          </p>
        )}
      </section>

      {saved && (
        <p
          key={saved.at}
          className="flex items-center gap-1.5 rounded-xl bg-credit-tint px-3.5 py-2.5 text-sm font-medium text-credit animate-fade-up"
        >
          <Check className="h-4 w-4" />
          {t('nEntriesSaved').replace('{value}', String(saved.count))}
        </p>
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
            <div className="hidden grid-cols-[5.5rem_minmax(0,1fr)_6rem_6rem_7rem_2rem] gap-3 border-b border-border py-2 text-[11px] font-medium text-muted-foreground sm:grid">
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
                    className="pressable flex min-w-0 flex-1 items-center gap-3 py-3 text-left sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)_6rem_6rem_7rem] sm:gap-3"
                  >
                    {/* phone: name over date · via, amount on the right */}
                    <span className="min-w-0 flex-1 sm:hidden">
                      <span className="block truncate text-[15px] font-medium">{customerName(item.customerId)}</span>
                      <span className="tnum block truncate text-xs text-muted-foreground">
                        {dateLabel}
                        {!debit && ` · ${paymentLabel(item.payment)}`}
                        {item.note && ` · ${item.note}`}
                      </span>
                    </span>
                    <span
                      className={cn('tnum shrink-0 text-[15px] font-medium sm:hidden', debit ? 'text-debit' : 'text-credit')}
                    >
                      {debit ? '−' : '+'}
                      {fmt(item.amount)}
                    </span>
                    {/* desktop: table cells */}
                    <span className="tnum hidden text-sm text-secondary-text sm:block">{dateLabel}</span>
                    <span className="hidden min-w-0 sm:block">
                      <span className="block truncate text-sm font-medium">{customerName(item.customerId)}</span>
                      {item.note && <span className="block truncate text-xs text-muted-foreground">{item.note}</span>}
                    </span>
                    <span className="tnum hidden text-right text-sm font-medium text-debit sm:block">
                      {debit ? fmt(item.amount) : ''}
                    </span>
                    <span className="tnum hidden text-right text-sm font-medium text-credit sm:block">
                      {debit ? '' : fmt(item.amount)}
                    </span>
                    <span className="hidden truncate text-sm text-secondary-text sm:block">
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

      <section className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-2 pt-3 lg:bottom-4">
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
