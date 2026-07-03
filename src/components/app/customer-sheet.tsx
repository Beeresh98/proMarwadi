import * as React from 'react'
import { AlertTriangle, ListFilter, Save } from 'lucide-react'
import { findDuplicateCustomer } from '../../lib/ledger'
import { useApp } from '../../lib/store'
import type { Customer } from '../../lib/types'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/form'
import { Picker } from '../ui/picker'
import { Sheet } from '../ui/sheet'

const ADD_NEW = '__add-new__'

const emptyForm = {
  name: '',
  phone: '',
  district: '',
  city: '',
  address: '',
  openingBalance: '0',
}

/* Dropdown of known values with a "+ Add new" action that swaps in a text
   input. Used for both district and city so location entry stays typo-proof. */
function LocationField({
  label,
  placeholder,
  addLabel,
  typePlaceholder,
  backLabel,
  value,
  list,
  newMode,
  onNewModeChange,
  onChange,
  disabled = false,
}: {
  label: string
  placeholder: string
  addLabel: string
  typePlaceholder: string
  backLabel: string
  value: string
  list: string[]
  newMode: boolean
  onNewModeChange: (mode: boolean) => void
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Field label={label}>
      {newMode && !disabled ? (
        <div className="relative animate-fade-up">
          <Input
            autoFocus={list.length > 0}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={typePlaceholder}
            className={list.length > 0 ? 'pr-11' : undefined}
          />
          {list.length > 0 && (
            <button
              type="button"
              aria-label={backLabel}
              title={backLabel}
              onClick={() => {
                onNewModeChange(false)
                onChange('')
              }}
              className="pressable absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ListFilter className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <Picker
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(next) => {
            if (next === ADD_NEW) {
              onNewModeChange(true)
              onChange('')
            } else {
              onChange(next)
            }
          }}
          options={[
            ...list.map((item) => ({ value: item, label: item })),
            { value: ADD_NEW, label: `+ ${addLabel}`, action: true },
          ]}
        />
      )}
    </Field>
  )
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
  const { t, customers, addCustomer, updateCustomer, knownDistricts, citiesFor } = useApp()
  const [form, setForm] = React.useState(emptyForm)
  const [duplicate, setDuplicate] = React.useState<Customer | null>(null)
  const [newCityMode, setNewCityMode] = React.useState(false)
  const [newDistrictMode, setNewDistrictMode] = React.useState(false)

  // merge the persisted directory with whatever's on current customers, so a
  // district/city never disappears just because its last customer was deleted
  const districts = React.useMemo(() => {
    const fromCustomers = customers.map((customer) => customer.district)
    return [...new Set([...knownDistricts, ...fromCustomers])].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [customers, knownDistricts])
  const scopedCities = React.useMemo(() => {
    const fromCustomers = customers
      .filter((customer) => customer.district === form.district)
      .map((customer) => customer.city)
    return [...new Set([...citiesFor(form.district), ...fromCustomers])].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [customers, form.district, citiesFor])

  React.useEffect(() => {
    if (!open) return
    setDuplicate(null)
    setNewDistrictMode(editing ? !districts.includes(editing.district) : districts.length === 0)
    const editingCities = editing
      ? customers.filter((customer) => customer.district === editing.district).map((customer) => customer.city)
      : []
    setNewCityMode(editing ? !editingCities.includes(editing.city) : false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <LocationField
            label={t('district')}
            placeholder={t('selectDistrict')}
            addLabel={t('addNewDistrict')}
            typePlaceholder={t('typeDistrictName')}
            backLabel={t('backToList')}
            value={form.district}
            list={districts}
            newMode={newDistrictMode}
            onNewModeChange={setNewDistrictMode}
            onChange={(district) => {
              setForm((current) =>
                current.district === district ? current : { ...current, district, city: '' },
              )
              setNewCityMode(false)
            }}
          />
          <LocationField
            label={t('city')}
            placeholder={t('selectCity')}
            addLabel={t('addNewCity')}
            typePlaceholder={t('typeCityName')}
            backLabel={t('backToList')}
            value={form.city}
            list={scopedCities}
            disabled={!form.district.trim()}
            newMode={newCityMode || scopedCities.length === 0}
            onNewModeChange={setNewCityMode}
            onChange={(city) => setForm((current) => ({ ...current, city }))}
          />
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
