import type { Customer, LedgerEntry, PaymentMode, Route } from './types'
import { customerBalance, totalsForEntries } from './ledger'

/* Pure aggregation helpers behind the Analytics screen and the PDF reports.
   All date math works on local-ISO (yyyy-mm-dd) strings, same as entry.date. */

export type PeriodGrain = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type PeriodBucket = {
  key: string
  label: string
  from: string
  to: string
  debit: number
  credit: number
  /* number of collection (credit) entries in the bucket */
  count: number
}

const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function totalsBetween(entries: LedgerEntry[], from: string, to: string) {
  let debit = 0
  let credit = 0
  let count = 0
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue
    if (entry.type === 'debit') debit += entry.amount
    else {
      credit += entry.amount
      count += 1
    }
  }
  return { debit, credit, count }
}

/* Time buckets ending today: 30 days / 12 weeks / 12 months / every year on
   record. Labels are compact for chart ticks. */
export function periodBuckets(entries: LedgerEntry[], grain: PeriodGrain): PeriodBucket[] {
  const now = new Date()
  const buckets: PeriodBucket[] = []

  if (grain === 'daily') {
    for (let index = 29; index >= 0; index -= 1) {
      const day = shiftDays(now, -index)
      const iso = toIso(day)
      buckets.push({
        key: iso,
        label: `${day.getDate()} ${monthShort[day.getMonth()]}`,
        from: iso,
        to: iso,
        ...totalsBetween(entries, iso, iso),
      })
    }
    return buckets
  }

  if (grain === 'weekly') {
    // weeks start Monday; current (partial) week is the last bucket
    const weekday = (now.getDay() + 6) % 7
    const currentWeekStart = shiftDays(now, -weekday)
    for (let index = 11; index >= 0; index -= 1) {
      const start = shiftDays(currentWeekStart, -7 * index)
      const end = shiftDays(start, 6)
      const from = toIso(start)
      const to = toIso(end)
      buckets.push({
        key: from,
        label: `${start.getDate()} ${monthShort[start.getMonth()]}`,
        from,
        to,
        ...totalsBetween(entries, from, to),
      })
    }
    return buckets
  }

  if (grain === 'monthly') {
    for (let index = 11; index >= 0; index -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - index, 1)
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
      const from = toIso(start)
      const to = toIso(end)
      buckets.push({
        key: from,
        label: `${monthShort[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`,
        from,
        to,
        ...totalsBetween(entries, from, to),
      })
    }
    return buckets
  }

  // yearly: from the earliest entry's year through this year
  const years = entries.map((entry) => Number(entry.date.slice(0, 4))).filter(Boolean)
  const firstYear = years.length > 0 ? Math.min(...years) : now.getFullYear()
  for (let year = firstYear; year <= now.getFullYear(); year += 1) {
    const from = `${year}-01-01`
    const to = `${year}-12-31`
    buckets.push({ key: from, label: String(year), from, to, ...totalsBetween(entries, from, to) })
  }
  return buckets
}

/* Buckets an arbitrary date range: single day → one bucket, up to ~3 months →
   per-day, longer → per-month. Powers the Today and Custom-range views. */
export function rangeBuckets(entries: LedgerEntry[], from: string, to: string): PeriodBucket[] {
  if (from > to) [from, to] = [to, from]
  const start = new Date(from)
  const end = new Date(to)
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const buckets: PeriodBucket[] = []

  if (spanDays <= 92) {
    for (let index = 0; index < spanDays; index += 1) {
      const day = shiftDays(start, index)
      const iso = toIso(day)
      buckets.push({
        key: iso,
        label: `${day.getDate()} ${monthShort[day.getMonth()]}`,
        from: iso,
        to: iso,
        ...totalsBetween(entries, iso, iso),
      })
    }
    return buckets
  }

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const bucketFrom = cursor < start ? from : toIso(cursor)
    const bucketTo = monthEnd > end ? to : toIso(monthEnd)
    buckets.push({
      key: bucketFrom,
      label: `${monthShort[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
      from: bucketFrom,
      to: bucketTo,
      ...totalsBetween(entries, bucketFrom, bucketTo),
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  return buckets
}

export type ModeSplit = {
  mode: PaymentMode
  total: number
  count: number
}

/* Collections by payment mode. Entries recorded before modes existed count as
   cash — that is what a plain received payment meant. */
export function paymentModeSplit(entries: LedgerEntry[], from: string, to: string): ModeSplit[] {
  const totals: Record<PaymentMode, ModeSplit> = {
    cash: { mode: 'cash', total: 0, count: 0 },
    bank: { mode: 'bank', total: 0, count: 0 },
    upi: { mode: 'upi', total: 0, count: 0 },
  }
  for (const entry of entries) {
    if (entry.type !== 'credit' || entry.date < from || entry.date > to) continue
    const slot = totals[entry.paymentMode ?? 'cash']
    slot.total += entry.amount
    slot.count += 1
  }
  return Object.values(totals).filter((slot) => slot.count > 0)
}

export type WeekdaySlot = {
  /* 0 = Monday … 6 = Sunday */
  weekday: number
  total: number
  count: number
}

/* Which weekdays actually bring money in — useful for planning route rounds.
   Date-only math: weekday derived from entry.date, Monday first. */
export function weekdayPattern(entries: LedgerEntry[], from: string, to: string): WeekdaySlot[] {
  const slots: WeekdaySlot[] = Array.from({ length: 7 }, (_, weekday) => ({ weekday, total: 0, count: 0 }))
  for (const entry of entries) {
    if (entry.type !== 'credit' || entry.date < from || entry.date > to) continue
    const slot = slots[(new Date(entry.date).getDay() + 6) % 7]
    slot.total += entry.amount
    slot.count += 1
  }
  return slots
}

export type EmployeeStat = {
  name: string
  total: number
  count: number
  average: number
}

/* Who collected how much — credits grouped by the recorded creator. */
export function employeeCollections(entries: LedgerEntry[], from: string, to: string): EmployeeStat[] {
  const byName = new Map<string, { total: number; count: number }>()
  for (const entry of entries) {
    if (entry.type !== 'credit' || entry.date < from || entry.date > to) continue
    const name = entry.createdBy || '—'
    const slot = byName.get(name) ?? { total: 0, count: 0 }
    slot.total += entry.amount
    slot.count += 1
    byName.set(name, slot)
  }
  return [...byName.entries()]
    .map(([name, slot]) => ({ name, ...slot, average: Math.round(slot.total / slot.count) }))
    .sort((a, b) => b.total - a.total)
}

export type RouteStat = {
  routeId: string
  name: string
  customers: number
  outstanding: number
  billed: number
  collected: number
}

/* Per-route book health: all-time outstanding plus billed/collected within the
   period. Customers without a route land in a trailing "—" bucket. */
export function routeAnalytics(
  routes: Route[],
  customers: Customer[],
  entries: LedgerEntry[],
  from: string,
  to: string,
): RouteStat[] {
  const stats: RouteStat[] = []
  const groups: Array<{ routeId: string; name: string; members: Customer[] }> = [
    ...[...routes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((route) => ({
        routeId: route.id,
        name: route.name,
        members: customers.filter((customer) => customer.routeId === route.id),
      })),
    { routeId: '', name: '—', members: customers.filter((customer) => !customer.routeId) },
  ]
  for (const group of groups) {
    if (group.routeId === '' && group.members.length === 0) continue
    const ids = new Set(group.members.map((customer) => customer.id))
    const scoped = entries.filter((entry) => ids.has(entry.customerId))
    const period = totalsBetween(scoped, from, to)
    stats.push({
      routeId: group.routeId,
      name: group.name,
      customers: group.members.length,
      outstanding: group.members.reduce((sum, customer) => sum + customerBalance(customer, entries), 0),
      billed: period.debit,
      collected: period.credit,
    })
  }
  return stats
}

export type DistrictStat = {
  name: string
  customers: number
  outstanding: number
  billed: number
  collected: number
}

/* Same book-health cut as routes, but by district. */
export function districtAnalytics(
  customers: Customer[],
  entries: LedgerEntry[],
  from: string,
  to: string,
): DistrictStat[] {
  const names = [...new Set(customers.map((customer) => customer.district))].filter(Boolean).sort()
  return names.map((name) => {
    const members = customers.filter((customer) => customer.district === name)
    const ids = new Set(members.map((customer) => customer.id))
    const scoped = entries.filter((entry) => ids.has(entry.customerId))
    const period = totalsBetween(scoped, from, to)
    return {
      name,
      customers: members.length,
      outstanding: members.reduce((sum, customer) => sum + customerBalance(customer, entries), 0),
      billed: period.debit,
      collected: period.credit,
    }
  })
}

export type CollectionLogRow = {
  date: string
  customerName: string
  amount: number
  mode: string
  collector: string
}

/* Flat list of every collection in the period — the daily reconciliation
   sheet. Newest first. */
export function collectionsLog(
  customers: Customer[],
  entries: LedgerEntry[],
  from: string,
  to: string,
): CollectionLogRow[] {
  const nameById = new Map(customers.map((customer) => [customer.id, customer.name]))
  return entries
    .filter((entry) => entry.type === 'credit' && entry.date >= from && entry.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((entry) => ({
      date: entry.date,
      customerName: nameById.get(entry.customerId) ?? '—',
      amount: entry.amount,
      mode: `${(entry.paymentMode ?? 'cash').toUpperCase()}${entry.bankName ? ` · ${entry.bankName}` : ''}${entry.upiApp ? ` · ${entry.upiApp}` : ''}`,
      collector: entry.createdBy || '—',
    }))
}

/* Customers who owe money and have gone quiet — the chase list. */
export function overdueCustomers(stats: CustomerStat[], minDays = 30): CustomerStat[] {
  return stats.filter(
    (stat) =>
      stat.outstanding > 0 && (stat.daysSinceLastPayment === null || stat.daysSinceLastPayment > minDays),
  )
}

export type CustomerStat = {
  customer: Customer
  outstanding: number
  billed: number
  collected: number
  payments: number
  lastPaymentDate: string
  daysSinceLastPayment: number | null
  /* average days between consecutive payments; null until 2+ payments */
  averageGapDays: number | null
}

/* All-time per-customer health: balances plus payment-frequency signals used
   to spot slow payers. */
export function customerAnalytics(customers: Customer[], entries: LedgerEntry[]): CustomerStat[] {
  const todayIso = toIso(new Date())
  return customers
    .map((customer) => {
      const own = entries.filter((entry) => entry.customerId === customer.id)
      const totals = totalsForEntries(own)
      const paymentDates = [...new Set(own.filter((entry) => entry.type === 'credit').map((entry) => entry.date))].sort()
      const last = paymentDates[paymentDates.length - 1] ?? ''
      let averageGapDays: number | null = null
      if (paymentDates.length >= 2) {
        const first = new Date(paymentDates[0])
        const final = new Date(last)
        averageGapDays = Math.round(
          (final.getTime() - first.getTime()) / 86400000 / (paymentDates.length - 1),
        )
      }
      return {
        customer,
        outstanding: customer.openingBalance + totals.debit - totals.credit,
        billed: totals.debit,
        collected: totals.credit,
        payments: own.filter((entry) => entry.type === 'credit').length,
        lastPaymentDate: last,
        daysSinceLastPayment: last
          ? Math.round((new Date(todayIso).getTime() - new Date(last).getTime()) / 86400000)
          : null,
        averageGapDays,
      }
    })
    .sort((a, b) => b.outstanding - a.outstanding)
}
