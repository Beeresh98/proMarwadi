import { ArrowDownLeft, ArrowUpRight, ChevronRight, MapPin } from 'lucide-react'
import { Avatar, Balance } from '../components/app/money'
import { Button } from '../components/ui/button'
import { customerBalance, districtStats, entriesInRange, totalsForEntries } from '../lib/ledger'
import { useApp } from '../lib/store'
import type { EntryType } from '../lib/types'
import { cn } from '../lib/utils'

export function HomeScreen({
  onOpenDistrict,
  onOpenCustomer,
  onNewEntry,
}: {
  onOpenDistrict: (district: string) => void
  onOpenCustomer: (customerId: string) => void
  onNewEntry: (type: EntryType) => void
}) {
  const { t, fmt, customers, entries, range } = useApp()

  const totalReceivable = customers.reduce((sum, customer) => sum + customerBalance(customer, entries), 0)
  const monthTotals = totalsForEntries(entriesInRange(entries, range))
  const districts = Array.from(new Set(customers.map((customer) => customer.district)))
    .filter(Boolean)
    .sort()
  const topCustomers = [...customers]
    .sort((a, b) => Math.abs(customerBalance(b, entries)) - Math.abs(customerBalance(a, entries)))
    .slice(0, 5)

  return (
    <div className="space-y-6 animate-fade-up">
      <section className="rounded-[var(--radius-card)] bg-hero p-5 text-hero-foreground lg:p-6">
        <p className="text-[13px] text-hero-muted">{t('totalToReceive')}</p>
        <p key={totalReceivable} className="tnum mt-0.5 text-[34px] font-medium leading-tight tracking-tight animate-fade-up">
          {fmt(totalReceivable)}
        </p>
        <div className="mt-2.5 flex gap-5 text-[13px] text-primary-accent">
          <span className="tnum inline-flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {fmt(monthTotals.debit)} {t('monthDebit')}
          </span>
          <span className="tnum inline-flex items-center gap-1">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            {fmt(monthTotals.credit)} {t('monthCredit')}
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-medium text-secondary-text">{t('districts')}</h2>
        <div className="stagger grid grid-cols-2 gap-3.5 lg:grid-cols-3">
          {districts.map((district) => {
            const stats = districtStats(district, customers, entries, range)
            return (
              <button
                key={district}
                type="button"
                onClick={() => onOpenDistrict(district)}
                className="pressable liftable rounded-[var(--radius-card)] border border-border/70 bg-fill p-4 text-left hover:border-primary-accent hover:bg-card"
              >
                <p className="flex items-center gap-1.5 text-[15px] font-medium">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {district}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stats.customers} {stats.customers === 1 ? t('customerWord') : t('customersWord')}
                </p>
                <p
                  className={cn(
                    'tnum mt-2 text-[17px] font-medium',
                    stats.receivable > 0 ? 'text-primary-pressed' : 'text-muted-foreground',
                  )}
                >
                  {fmt(stats.receivable)}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-medium text-secondary-text">{t('recentCustomers')}</h2>
        <div className="stagger rounded-[var(--radius-card)] border border-border bg-card px-4">
          {topCustomers.map((customer) => (
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
                </p>
              </div>
              <Balance amount={customerBalance(customer, entries)} amountClassName="text-[15px]" />
              <ChevronRight className="h-4 w-4 shrink-0 text-border-strong transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <section className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-3 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-2 pt-3 lg:bottom-6">
        <Button
          variant="debit"
          className="flex-1 border-[1.5px] font-semibold shadow-[0_8px_20px_rgba(163,45,45,0.18)]"
          onClick={() => onNewEntry('debit')}
        >
          <ArrowUpRight className="h-4 w-4" />
          {t('youGave')} −
        </Button>
        <Button
          variant="credit"
          className="flex-1 font-semibold shadow-[0_8px_20px_rgba(59,109,17,0.22)]"
          onClick={() => onNewEntry('credit')}
        >
          <ArrowDownLeft className="h-4 w-4" />
          {t('youGot')} +
        </Button>
      </section>
    </div>
  )
}
