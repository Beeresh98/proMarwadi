export type Language = 'en' | 'hi'

export type UserRole = 'admin' | 'staff'

/* Extensible — 'collection' (Collection Staff) is the only type for now. */
export const staffTypes = ['collection'] as const
export type StaffType = (typeof staffTypes)[number]

/* Firestore users/{uid} document. Roles live server-side only — the client
   can never grant itself access; rules verify this doc on every request. */
export type UserProfile = {
  role: UserRole
  name?: string
  email?: string
  phone?: string
  /* Staff only. */
  staffType?: StaffType
  /* Staff only: the routes this account may see. No routes = no customers. */
  allowedRouteIds?: string[]
}

/* A users/{uid} doc paired with its uid, for the admin staff list. */
export type StaffAccount = UserProfile & { uid: string }

/* Districts/cities a user has ever typed in, persisted independently of
   customer records so a name doesn't vanish from the dropdown just because
   the last customer referencing it got deleted. */
export type LocationDirectory = {
  districts: string[]
  cities: Record<string, string[]>
}

/* Collection routes — the areas an agent covers on a round. Customers are
   assigned a route; staff will later be restricted to their allotted routes. */
export type Route = {
  id: string
  name: string
  createdAt: string
  updatedAt?: string
}

export type PaymentAccountType = 'bank' | 'upi'

/* Admin-managed bank accounts / UPI handles that payments can land in.
   Exactly one account is flagged default at a time (enforced in the store). */
export type PaymentAccount = {
  id: string
  type: PaymentAccountType
  name: string
  /* Account number / IFSC for banks, UPI ID for UPI handles. */
  detail?: string
  isDefault: boolean
  createdAt: string
  updatedAt?: string
}

/* 'ddMMMyyyy' renders 6 Jul 2026 (the app's original style), 'ddmmyyyy'
   renders 06/07/2026. */
export type DateFormatPref = 'ddmmyyyy' | 'ddMMMyyyy'

export type LandingPagePref = 'highestBalance' | 'lastEntries'

export type AppPreferences = {
  dateFormat: DateFormatPref
  landingPage: LandingPagePref
}

export const defaultPreferences: AppPreferences = {
  dateFormat: 'ddMMMyyyy',
  landingPage: 'highestBalance',
}

export type EntryType = 'debit' | 'credit'

export type PaymentMode = 'cash' | 'bank' | 'upi'

export type Customer = {
  id: string
  name: string
  phone: string
  district: string
  city: string
  address?: string
  /* Collection route the customer belongs to. Absent on old data. */
  routeId?: string
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
