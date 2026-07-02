import * as React from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { EntryType, LedgerEntry } from '../../lib/types'
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
  const { t, customers, entries, addEntry, updateEntry, isAdmin } = useApp()
  const { language } = useApp()
  const editing: LedgerEntry | undefined = draft?.entryId
    ? entries.find((entry) => entry.id === draft.entryId)
    : undefined

  const [form, setForm] = React.useState({
    customerId: '',
    date: today,
    type: 'debit' as EntryType,
    amount: '',
    note: '',
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
      })
    } else {
      setForm({
        customerId: draft.customerId || customers[0]?.id || '',
        date: today,
        type: draft.type,
        amount: '',
        note: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (!draft) return null
  if (editing && !isAdmin) return null

  const amount = Number(form.amount)
  const valid = form.customerId && amount > 0

  function submit() {
    if (!valid) return
    const input = {
      customerId: form.customerId,
      date: form.date,
      type: form.type,
      amount,
      note: form.note.trim(),
    }
    if (editing) updateEntry(editing.id, input)
    else addEntry(input)
    onClose()
  }

  return (
    <Sheet open title={editing ? t('edited') : t('newEntry')} onClose={onClose}>
      <div className="grid gap-4 pt-1">
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

        <Field label={t('customer')}>
          <Picker
            value={form.customerId}
            onChange={(customerId) => setForm({ ...form, customerId })}
            placeholder={t('selectCustomer')}
            searchable
            searchPlaceholder={t('searchCustomer')}
            options={customers.map((customer) => ({
              value: customer.id,
              label: customer.name,
              hint: `${customer.city} · ${customer.district}`,
            }))}
          />
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

        <Field label={t('date')}>
          <DatePicker value={form.date} onChange={(date) => setForm({ ...form, date })} language={language} />
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
