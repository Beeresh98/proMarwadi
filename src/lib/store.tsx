import * as React from 'react'
import { dictionary, type TranslationKey } from './i18n'
import { seedCustomers, seedEntries, today } from './ledger'
import type { Customer, DateRange, EntryType, Language, LedgerEntry, UserRole } from './types'
import { currentMonthRange } from './ledger'

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function loadStored<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function saveStored<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export type CustomerInput = {
  name: string
  phone: string
  district: string
  city: string
  address: string
  openingBalance: number
}

export type EntryInput = {
  customerId: string
  date: string
  type: EntryType
  amount: number
  note: string
}

type AppStore = {
  language: Language
  setLanguage: (language: Language) => void
  role: UserRole
  setRole: (role: UserRole) => void
  isAdmin: boolean
  t: (key: TranslationKey) => string
  fmt: (amount: number) => string
  customers: Customer[]
  entries: LedgerEntry[]
  range: DateRange
  setRange: (range: DateRange) => void
  addCustomer: (input: CustomerInput) => Customer
  updateCustomer: (id: string, input: CustomerInput) => void
  deleteCustomer: (id: string) => void
  addEntry: (input: EntryInput) => void
  updateEntry: (id: string, input: EntryInput) => void
  deleteEntry: (id: string) => void
}

const AppContext = React.createContext<AppStore | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(() =>
    loadStored<Language>('promarwadi-language', 'en'),
  )
  const [role, setRoleState] = React.useState<UserRole>(() =>
    loadStored<UserRole>('promarwadi-role', 'admin'),
  )
  const [customers, setCustomers] = React.useState<Customer[]>(() =>
    loadStored('promarwadi-customers', seedCustomers),
  )
  const [entries, setEntries] = React.useState<LedgerEntry[]>(() =>
    loadStored('promarwadi-entries', seedEntries),
  )
  const [range, setRange] = React.useState<DateRange>(currentMonthRange)

  const setLanguage = React.useCallback((next: Language) => {
    setLanguageState(next)
    saveStored('promarwadi-language', next)
    document.documentElement.lang = next
  }, [])

  const setRole = React.useCallback((next: UserRole) => {
    setRoleState(next)
    saveStored('promarwadi-role', next)
  }, [])

  const persistCustomers = React.useCallback((next: Customer[]) => {
    setCustomers(next)
    saveStored('promarwadi-customers', next)
  }, [])

  const persistEntries = React.useCallback((next: LedgerEntry[]) => {
    setEntries(next)
    saveStored('promarwadi-entries', next)
  }, [])

  const store: AppStore = {
    language,
    setLanguage,
    role,
    setRole,
    isAdmin: role === 'admin',
    t: (key) => dictionary[language][key],
    fmt: (amount) => currency.format(amount),
    customers,
    entries,
    range,
    setRange,
    addCustomer: (input) => {
      const customer: Customer = { id: makeId('customer'), ...input, createdAt: today }
      persistCustomers([...customers, customer])
      return customer
    },
    updateCustomer: (id, input) => {
      persistCustomers(
        customers.map((customer) =>
          customer.id === id ? { ...customer, ...input, updatedAt: today } : customer,
        ),
      )
    },
    deleteCustomer: (id) => {
      persistCustomers(customers.filter((customer) => customer.id !== id))
      persistEntries(entries.filter((entry) => entry.customerId !== id))
    },
    addEntry: (input) => {
      const entry: LedgerEntry = {
        id: makeId('entry'),
        ...input,
        createdAt: new Date().toISOString(),
        createdBy: role,
        isEdited: false,
        editCount: 0,
      }
      persistEntries([...entries, entry])
    },
    updateEntry: (id, input) => {
      persistEntries(
        entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...input,
                updatedAt: new Date().toISOString(),
                updatedBy: role,
                isEdited: true,
                editCount: entry.editCount + 1,
              }
            : entry,
        ),
      )
    },
    deleteEntry: (id) => {
      persistEntries(entries.filter((entry) => entry.id !== id))
    },
  }

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>
}

export function useApp() {
  const store = React.useContext(AppContext)
  if (!store) throw new Error('useApp must be used inside AppProvider')
  return store
}
