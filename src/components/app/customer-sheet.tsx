import * as React from 'react'
import { AlertTriangle, Save } from 'lucide-react'
import { findDuplicateCustomer } from '../../lib/ledger'
import { useApp } from '../../lib/store'
import type { Customer } from '../../lib/types'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/form'
import { Sheet } from '../ui/sheet'

const emptyForm = {
  name: '',
  phone: '',
  district: '',
  city: '',
  address: '',
  openingBalance: '0',
}

export function CustomerSheet({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: Customer | null
  onClose: () => void
}) {
  const { t, customers, addCustomer, updateCustomer } = useApp()
  const [form, setForm] = React.useState(emptyForm)
  const [duplicate, setDuplicate] = React.useState<Customer | null>(null)

  React.useEffect(() => {
    if (!open) return
    setDuplicate(null)
    setForm(
      editing
        ? {
            name: editing.name,
            phone: editing.phone,
            district: editing.district,
            city: editing.city,
            address: editing.address ?? '',
            openingBalance: String(editing.openingBalance),
          }
        : emptyForm,
    )
  }, [open, editing])

  const valid = form.name.trim() && form.district.trim() && form.city.trim()

  function submit() {
    if (!valid) return
    const match = findDuplicateCustomer(
      { name: form.name, phone: form.phone, city: form.city },
      customers,
      editing?.id,
    )
    if (match && match.id !== duplicate?.id) {
      setDuplicate(match)
      return
    }
    const input = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      district: form.district.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      openingBalance: Number(form.openingBalance) || 0,
    }
    if (editing) updateCustomer(editing.id, input)
    else addCustomer(input)
    onClose()
  }

  return (
    <Sheet open={open} title={editing ? t('editCustomer') : t('addCustomer')} onClose={onClose}>
      <div className="grid gap-4 pt-1">
        {duplicate && (
          <div className="flex items-start gap-2.5 rounded-xl border border-debit-strong/40 bg-debit-tint p-3 text-sm text-debit animate-fade-up">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t('duplicateWarning')}: <span className="font-medium">{duplicate.name}</span>
              {duplicate.phone && ` · ${duplicate.phone}`} · {duplicate.city}
            </p>
          </div>
        )}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('district')}>
            <Input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} />
          </Field>
          <Field label={t('city')}>
            <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </Field>
        </div>
        <Field label={t('address')}>
          <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </Field>
        <Field label={t('openingBalance')}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
            <Input
              type="number"
              inputMode="numeric"
              value={form.openingBalance}
              onChange={(event) => setForm({ ...form, openingBalance: event.target.value })}
              className="tnum pl-8"
            />
          </div>
        </Field>
        <Button disabled={!valid} onClick={submit} className="mt-1">
          <Save className="h-4 w-4" />
          {duplicate ? `${t('save')} — ${t('duplicateWarning')}?` : t('save')}
        </Button>
      </div>
    </Sheet>
  )
}
