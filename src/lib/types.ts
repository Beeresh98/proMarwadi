export type Language = 'en' | 'hi'

export type UserRole = 'admin' | 'staff'

export type EntryType = 'debit' | 'credit'

export type Customer = {
  id: string
  name: string
  phone: string
  district: string
  city: string
  address?: string
  openingBalance: number
  createdAt: string
  updatedAt?: string
}

export type LedgerEntry = {
  id: string
  customerId: string
  date: string
  type: EntryType
  amount: number
  note?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
  isEdited: boolean
  editCount: number
}

export type DateRange = {
  from: string
  to: string
}

export type ReportType =
  | 'customer'
  | 'allClients'
  | 'daySummary'
  | 'monthSummary'
  | 'citySummary'
  | 'cityDaySummary'
  | 'districtSummary'
  | 'districtDaySummary'
