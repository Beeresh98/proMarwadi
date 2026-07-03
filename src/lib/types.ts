export type Language = 'en' | 'hi'

export type UserRole = 'admin' | 'staff'

/* Firestore users/{uid} document. Roles live server-side only — the client
   can never grant itself access; rules verify this doc on every request. */
export type UserProfile = {
  role: UserRole
  name?: string
  email?: string
  phone?: string
}

export type EntryType = 'debit' | 'credit'

export type PaymentMode = 'cash' | 'bank' | 'upi'

export const upiApps = ['GPay', 'PhonePe', 'Paytm', 'Amazon Pay', 'Other'] as const
export type UpiApp = (typeof upiApps)[number]

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
  /* Credit entries only. Absent on old data — treat missing as plain payment. */
  paymentMode?: PaymentMode
  bankName?: string
  upiApp?: string
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
