import * as React from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { Avatar, Balance } from '../components/app/money'
import { Button } from '../components/ui/button'
import { formatDisplayDate } from '../components/ui/date-picker'
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
  const { t, fmt, language, customers, entries, range, preferences } = useApp()

  const totalReceivable = customers.reduce((sum, customer) => sum + customerBalance(customer, entries), 0)
  const monthTotals = totalsForEntries(entriesInRange(entries, range))
  const districts = Array.from(new Set(customers.map((customer) => customer.district)))
    .filter(Boolean)
    .sort()

  const carouselRef = React.useRef<HTMLDivElement>(null)
  const [carousel, setCarousel] = React.useState({ page: 0, pages: 1 })

  const updateCarousel = React.useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth))
    // map against the real scrollable distance — max scroll is less than one
    // full page width, so dividing by clientWidth never reaches the last page
    const page = maxScroll > 0 ? Math.round((el.scrollLeft / maxScroll) * (pages - 1)) : 0
    setCarousel((current) => (current.page === page && current.pages === pages ? current : { page, pages }))
  }, [])

  React.useEffect(() => {
    updateCarousel()
    window.addEventListener('resize', updateCarousel)
    return () => window.removeEventListener('resize', updateCarousel)
  }, [updateCarousel, districts.length])

  function scrollToPage(page: number) {
    const el = carouselRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth))
    el.scrollTo({ left: pages > 1 ? (page * maxScroll) / (pages - 1) : 0, behavior: 'smooth' })
  }
  const topCustomers = [...customers]
    .sort((a, b) => Math.abs(customerBalance(b, entries)) - Math.abs(customerBalance(a, entries)))
    .slice(0, 5)

  // admin preference decides the landing highlight: highest balances or latest activity
  const lastEntries = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((entry) => ({ entry, customer: customers.find((customer) => customer.id === entry.customerId) }))

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
        <div className="relative">
          {carousel.pages > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous"
                disabled={carousel.page === 0}
                onClick={() => scrollToPage(carousel.page - 1)}
                className="pressable absolute -left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-secondary-text shadow-[0_2px_10px_rgba(44,44,42,0.14)] hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                disabled={carousel.page === carousel.pages - 1}
                onClick={() => scrollToPage(carousel.page + 1)}
                className="pressable absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-secondary-text shadow-[0_2px_10px_rgba(44,44,42,0.14)] hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <div
            ref={carouselRef}
            onScroll={updateCarousel}
            className="no-scrollbar stagger -my-3 flex snap-x snap-mandatory gap-3.5 overflow-x-auto py-3"
          >
            {districts.map((district) => {
              const stats = districtStats(district, customers, entries, range)
              return (
                <button
                  key={district}
                  type="button"
                  onClick={() => onOpenDistrict(district)}
                  className="pressable liftable w-[46%] shrink-0 snap-start rounded-[var(--radius-card)] border border-border/70 bg-fill p-4 text-left hover:border-primary-accent hover:bg-card sm:w-[31.5%]"
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
        </div>
        {carousel.pages > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {Array.from({ length: carousel.pages }).map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`${t('districts')} ${index + 1}`}
                onClick={() => scrollToPage(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  index === carousel.page ? 'w-5 bg-primary' : 'w-1.5 bg-border-strong hover:bg-muted-foreground',
                )}
              />
            ))}
          </div>
        )}
      </section>

      {preferences.landingPage === 'lastEntries' ? (
        <section>
          <h2 className="mb-3 text-[13px] font-medium text-secondary-text">{t('recentEntries')}</h2>
          <div className="stagger rounded-[var(--radius-card)] border border-border bg-card px-4">
            {lastEntries.map(({ entry, customer }) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => customer && onOpenCustomer(customer.id)}
                className="pressable group flex w-full items-center gap-3.5 border-b border-border py-3.5 text-left last:border-b-0"
              >
                <Avatar name={customer?.name ?? '?'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{customer?.name ?? '—'}</p>
                  <p className="tnum truncate text-xs text-muted-foreground">
                    {formatDisplayDate(entry.date, language, preferences.dateFormat)}
                    {entry.note && ` · ${entry.note}`}
                  </p>
                </div>
                <span
                  className={cn(
                    'tnum shrink-0 text-[15px] font-medium',
                    entry.type === 'debit' ? 'text-debit' : 'text-credit',
                  )}
                >
                  {entry.type === 'debit' ? '−' : '+'}
                  {fmt(entry.amount)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-border-strong transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      ) : (
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
      )}

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
