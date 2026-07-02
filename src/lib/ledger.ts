import type { Customer, DateRange, LedgerEntry } from './types'

function toLocalIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const today = toLocalIso(new Date())

export function currentMonthRange(): DateRange {
  const now = new Date()
  return {
    from: toLocalIso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toLocalIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

export const seedCustomers: Customer[] = [
  {
    id: 'c1',
    name: 'Ramesh Footwear',
    phone: '9876543210',
    district: 'Jodhpur',
    city: 'Bilara',
    address: 'Main Bazaar',
    openingBalance: 12000,
    createdAt: today,
  },
  {
    id: 'c2',
    name: 'Mahadev Traders',
    phone: '9876501234',
    district: 'Jodhpur',
    city: 'Pipar',
    openingBalance: 4500,
    createdAt: today,
  },
  {
    id: 'c3',
    name: 'Shree Balaji Store',
    phone: '9988776655',
    district: 'Pali',
    city: 'Sojat',
    openingBalance: 8000,
    createdAt: today,
  },
]

export const seedEntries: LedgerEntry[] = [
  {
    id: 'e1',
    customerId: 'c1',
    date: today,
    type: 'debit',
    amount: 2200,
    note: 'New stock',
    createdAt: today,
    createdBy: 'admin',
    isEdited: false,
    editCount: 0,
  },
  {
    id: 'e2',
    customerId: 'c1',
    date: today,
    type: 'credit',
    amount: 5000,
    note: 'Cash received',
    createdAt: today,
    createdBy: 'admin',
    isEdited: true,
    editCount: 1,
  },
  {
    id: 'e3',
    customerId: 'c2',
    date: today,
    type: 'debit',
    amount: 1800,
    createdAt: today,
    createdBy: 'staff',
    isEdited: false,
    editCount: 0,
  },
]

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function entriesInRange(entries: LedgerEntry[], range: DateRange) {
  return entries.filter((entry) => entry.date >= range.from && entry.date <= range.to)
}

export function totalsForEntries(entries: LedgerEntry[]) {
  return entries.reduce(
    (totals, entry) => {
      if (entry.type === 'debit') totals.debit += entry.amount
      if (entry.type === 'credit') totals.credit += entry.amount
      return totals
    },
    { debit: 0, credit: 0 },
  )
}

export function customerBalance(customer: Customer, entries: LedgerEntry[]) {
  const totals = totalsForEntries(entries.filter((entry) => entry.customerId === customer.id))
  return customer.openingBalance + totals.debit - totals.credit
}

export function districtStats(
  district: string,
  customers: Customer[],
  entries: LedgerEntry[],
  range: DateRange,
) {
  const districtCustomers = customers.filter((customer) => customer.district === district)
  const ids = new Set(districtCustomers.map((customer) => customer.id))
  const rangedEntries = entriesInRange(entries, range).filter((entry) => ids.has(entry.customerId))
  const totals = totalsForEntries(rangedEntries)
  const receivable = districtCustomers.reduce(
    (sum, customer) => sum + customerBalance(customer, entries),
    0,
  )
  return { customers: districtCustomers.length, receivable, ...totals }
}

export function ledgerRows(customer: Customer, entries: LedgerEntry[], range: DateRange) {
  let runningBalance = customer.openingBalance
  return entries
    .filter((entry) => entry.customerId === customer.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((entry) => {
      runningBalance += entry.type === 'debit' ? entry.amount : -entry.amount
      return { ...entry, runningBalance }
    })
    .filter((entry) => entry.date >= range.from && entry.date <= range.to)
}

export function findDuplicateCustomer(
  candidate: Pick<Customer, 'name' | 'phone' | 'city'>,
  customers: Customer[],
  ignoreId?: string,
) {
  const phone = candidate.phone.trim()
  const name = normalizeText(candidate.name)
  const city = normalizeText(candidate.city)
  return customers.find((customer) => {
    if (customer.id === ignoreId) return false
    const samePhone = phone.length > 0 && customer.phone.trim() === phone
    const sameNameCity =
      normalizeText(customer.name) === name && normalizeText(customer.city) === city
    return samePhone || sameNameCity
  })
}

export function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function toCsv(rows: Array<Record<string, string | number | boolean | undefined>>) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (value: string | number | boolean | undefined) =>
    `"${String(value ?? '').replaceAll('"', '""')}"`
  return [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))]
    .join('\n')
}
