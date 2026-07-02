import * as React from 'react'
import { ChevronRight, Plus, Search, UserPlus } from 'lucide-react'
import { Avatar, Balance } from '../components/app/money'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/form'
import { Picker } from '../components/ui/picker'
import { customerBalance } from '../lib/ledger'
import { useApp } from '../lib/store'

export function CustomersScreen({
  districtFilter,
  onDistrictFilterChange,
  onOpenCustomer,
  onAddCustomer,
}: {
  districtFilter: string
  onDistrictFilterChange: (district: string) => void
  onOpenCustomer: (customerId: string) => void
  onAddCustomer: () => void
}) {
  const { t, customers, entries } = useApp()
  const [search, setSearch] = React.useState('')

  const districts = Array.from(new Set(customers.map((customer) => customer.district)))
    .filter(Boolean)
    .sort()

  const query = search.trim().toLowerCase()
  const visible = customers
    .filter((customer) => !districtFilter || customer.district === districtFilter)
    .filter((customer) => {
      if (!query) return true
      return [customer.name, customer.phone, customer.city, customer.district].some((value) =>
        value.toLowerCase().includes(query),
      )
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder={t('searchCustomer')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Picker
          className="w-36 shrink-0"
          align="right"
          value={districtFilter}
          onChange={onDistrictFilterChange}
          options={[
            { value: '', label: t('allDistricts') },
            ...districts.map((district) => ({ value: district, label: district })),
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong py-12 text-center animate-fade-up">
          <UserPlus className="h-8 w-8 text-border-strong" />
          <p className="max-w-56 text-sm text-muted-foreground">{t('noCustomers')}</p>
          <Button size="sm" variant="secondary" onClick={onAddCustomer}>
            <Plus className="h-4 w-4" />
            {t('addCustomer')}
          </Button>
        </div>
      ) : (
        <div className="stagger rounded-[var(--radius-card)] border border-border bg-card px-4">
          {visible.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onOpenCustomer(customer.id)}
              className="pressable group flex w-full items-center gap-3.5 border-b border-border py-3.5 text-left last:border-b-0"
            >
              <Avatar name={customer.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{customer.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {customer.city} · {customer.district}
                  {customer.phone && ` · ${customer.phone}`}
                </p>
              </div>
              <Balance amount={customerBalance(customer, entries)} amountClassName="text-[15px]" />
              <ChevronRight className="h-4 w-4 shrink-0 text-border-strong transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex justify-end bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-2 pt-3 lg:bottom-6">
        <Button onClick={onAddCustomer} className="font-semibold shadow-[0_8px_20px_rgba(15,110,86,0.3)]">
          <Plus className="h-4 w-4" />
          {t('addCustomer')}
        </Button>
      </div>
    </div>
  )
}
