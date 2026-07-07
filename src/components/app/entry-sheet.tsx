import * as React from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { EntryType, LedgerEntry, PaymentAccount, PaymentMode } from '../../lib/types'
import { today } from '../../lib/ledger'
import { useApp } from '../../lib/store'
import { Button } from '../ui/button'
import { DatePicker } from '../ui/date-picker'
import { Field, Input } from '../ui/form'
import { Picker, SegmentedControl } from '../ui/picker'
import { Sheet } from '../ui/sheet'

export type EntryDraft = {
  entryId?: string
  customerId: string
  type: EntryType
}

export function EntrySheet({
  draft,
  onClose,
}: {
  draft: EntryDraft | null
  onClose: () => void
}) {
  const { t, customers, entries, addEntry, updateEntry, isAdmin, paymentAccounts, defaultPaymentAccount } = useApp()
  const { language, preferences } = useApp()
  const editing: LedgerEntry | undefined = draft?.entryId
    ? entries.find((entry) => entry.id === draft.entryId)
    : undefined

  const bankAccounts = paymentAccounts.filter((account) => account.type === 'bank')
  const upiAccounts = paymentAccounts.filter((account) => account.type === 'upi')
  function defaultAccountFor(type: PaymentMode): PaymentAccount | undefined {
    const list = type === 'bank' ? bankAccounts : type === 'upi' ? upiAccounts : []
    return list.find((account) => account.isDefault) ?? list[0]
  }

  const [form, setForm] = React.useState({
    customerId: '',
    date: today,
    type: 'debit' as EntryType,
    amount: '',
    note: '',
    paymentMode: 'cash' as PaymentMode,
    bankName: '',
    upiApp: '',
  })

  React.useEffect(() => {
    if (!draft) return
    if (editing) {
      setForm({
        customerId: editing.customerId,
        date: editing.date,
        type: editing.type,
        amount: String(editing.amount),
        note: editing.note ?? '',
        // old entries have no mode — default to cash so the form stays valid
        paymentMode: editing.paymentMode ?? 'cash',
        bankName: editing.bankName ?? '',
        upiApp: editing.upiApp ?? '',
      })
    } else {
      // preselect the admin's configured default account, per Settings → Banks & UPI
      const account = defaultPaymentAccount
      setForm({
        customerId: draft.customerId || customers[0]?.id || '',
        date: today,
        // staff only receive payments — never raise bills
        type: isAdmin ? draft.type : 'credit',
        amount: '',
        note: '',
        paymentMode: account?.type ?? 'cash',
        bankName: account?.type === 'bank' ? account.name : '',
        upiApp: account?.type === 'upi' ? account.name : '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (!draft) return null
  if (editing && !isAdmin) return null

  // opened from a specific customer's ledger (or editing an existing entry,
  // which always belongs to a customer) — the customer shouldn't be swapped out
  const lockedCustomer = Boolean(draft.customerId)
  const customer = customers.find((item) => item.id === form.customerId)

  const amount = Number(form.amount)
  const isCredit = form.type === 'credit'
  const modeValid =
    !isCredit ||
    form.paymentMode === 'cash' ||
    (form.paymentMode === 'bank' ? form.bankName.trim().length > 0 : form.upiApp.length > 0)
  const valid = Boolean(form.customerId) && amount > 0 && modeValid

  function submit() {
    if (!valid) return
    const credit = form.type === 'credit'
    const input = {
      customerId: form.customerId,
      date: form.date,
      type: form.type,
      amount,
      note: form.note.trim(),
      // explicit undefined so editing an entry replaces stale mode fields
      paymentMode: credit ? form.paymentMode : undefined,
      bankName: credit && form.paymentMode === 'bank' ? form.bankName.trim() : undefined,
      upiApp: credit && form.paymentMode === 'upi' ? form.upiApp : undefined,
    }
    if (editing) updateEntry(editing.id, input)
    else addEntry(input)
    onClose()
  }

  return (
    <Sheet
      open
      title={editing ? t('edited') : isAdmin ? t('newEntry') : t('receivePayment')}
      onClose={onClose}
    >
      <div className="grid gap-4 pt-1">
        {isAdmin && (
          <SegmentedControl
            value={form.type}
            onChange={(type) => setForm({ ...form, type })}
            options={[
              {
                value: 'debit',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4" />
                    {t('youGave')} −
                  </span>
                ),
                activeClassName: 'text-debit',
              },
              {
                value: 'credit',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowDownLeft className="h-4 w-4" />
                    {t('youGot')} +
                  </span>
                ),
                activeClassName: 'text-credit',
              },
            ]}
          />
        )}

        <Field label={t('customer')}>
          {lockedCustomer ? (
            <div className="flex h-12 w-full items-center rounded-[var(--radius-control)] border border-input bg-muted px-3.5 text-[15px] text-foreground">
              {customer?.name ?? '—'}
            </div>
          ) : (
            <Picker
              value={form.customerId}
              onChange={(customerId) => setForm({ ...form, customerId })}
              placeholder={t('selectCustomer')}
              searchable
              searchPlaceholder={t('searchCustomer')}
              options={customers.map((item) => ({
                value: item.id,
                label: item.name,
                hint: `${item.city} · ${item.district}`,
              }))}
            />
          )}
        </Field>

        <Field label={t('amount')}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
              ₹
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              autoFocus
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              className="tnum pl-8 text-lg font-medium"
              placeholder="0"
            />
          </div>
        </Field>

        {isCredit && (
          <div className="grid gap-4 animate-fade-up">
            <Field label={t('paymentMode')}>
              <SegmentedControl
                value={form.paymentMode}
                onChange={(paymentMode) => {
                  // switching mode preselects that mode's configured default account
                  const account = defaultAccountFor(paymentMode)
                  setForm((current) => ({
                    ...current,
                    paymentMode,
                    bankName: paymentMode === 'bank' ? (account?.name ?? '') : current.bankName,
                    upiApp: paymentMode === 'upi' ? (account?.name ?? '') : current.upiApp,
                  }))
                }}
                options={[
                  { value: 'cash', label: t('cash'), activeClassName: 'text-credit' },
                  { value: 'bank', label: t('bank'), activeClassName: 'text-credit' },
                  { value: 'upi', label: t('upi'), activeClassName: 'text-credit' },
                ]}
              />
            </Field>
            {form.paymentMode === 'bank' &&
              (bankAccounts.length > 0 ? (
                <Field label={t('bankName')} className="animate-fade-up">
                  <Picker
                    value={form.bankName}
                    onChange={(bankName) => setForm({ ...form, bankName })}
                    placeholder={t('bankName')}
                    options={bankAccounts.map((account) => ({
                      value: account.name,
                      label: account.name,
                      hint: account.detail,
                    }))}
                  />
                </Field>
              ) : (
                <Field label={t('bankName')} className="animate-fade-up">
                  <Input
                    value={form.bankName}
                    onChange={(event) => setForm({ ...form, bankName: event.target.value })}
                    placeholder="SBI, HDFC…"
                  />
                </Field>
              ))}
            {form.paymentMode === 'upi' &&
              (upiAccounts.length > 0 ? (
                <Field label={t('selectApp')} className="animate-fade-up">
                  <Picker
                    value={form.upiApp}
                    onChange={(upiApp) => setForm({ ...form, upiApp })}
                    placeholder={t('selectApp')}
                    options={upiAccounts.map((account) => ({
                      value: account.name,
                      label: account.name,
                      hint: account.detail,
                    }))}
                  />
                </Field>
              ) : (
                <Field label={t('selectApp')} className="animate-fade-up">
                  <Input
                    value={form.upiApp}
                    onChange={(event) => setForm({ ...form, upiApp: event.target.value })}
                    placeholder="GPay, PhonePe…"
                  />
                </Field>
              ))}
          </div>
        )}

        <Field label={t('date')}>
          <DatePicker value={form.date} onChange={(date) => setForm({ ...form, date })} language={language} dateFormat={preferences.dateFormat} />
        </Field>

        <Field label={t('note')}>
          <Input
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="—"
          />
        </Field>

        <Button
          variant={form.type === 'debit' ? 'debit' : 'credit'}
          disabled={!valid}
          onClick={submit}
          className="mt-1"
        >
          {form.type === 'debit' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
          {editing ? t('updateEntry') : t('saveEntry')}
        </Button>
      </div>
    </Sheet>
  )
}
