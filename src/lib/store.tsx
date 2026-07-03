import * as React from 'react'
import { arrayUnion, collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import { useAuth } from './auth'
import { db, isFirebaseConfigured } from './firebase'
import { dictionary, type TranslationKey } from './i18n'
import { seedCustomers, seedEntries, today } from './ledger'
import type {
  Customer,
  DateRange,
  EntryType,
  Language,
  LedgerEntry,
  LocationDirectory,
  PaymentMode,
  UserRole,
} from './types'
import { currentMonthRange } from './ledger'

const emptyLocations: LocationDirectory = { districts: [], cities: {} }

function deriveLocations(customers: Customer[]): LocationDirectory {
  const districts: string[] = []
  const cities: Record<string, string[]> = {}
  for (const customer of customers) {
    if (customer.district && !districts.includes(customer.district)) districts.push(customer.district)
    if (customer.district && customer.city) {
      const list = cities[customer.district] ?? (cities[customer.district] = [])
      if (!list.includes(customer.city)) list.push(customer.city)
    }
  }
  return { districts, cities }
}

function unionInto(list: string[] | undefined, value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return list ?? []
  return list?.includes(trimmed) ? list : [...(list ?? []), trimmed]
}

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

/* Firestore rejects undefined values — drop those keys before writing. */
function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
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
  /* Always passed explicitly (undefined when not applicable) so that an
     update replaces stale mode fields instead of keeping them via spread. */
  paymentMode?: PaymentMode
  bankName?: string
  upiApp?: string
}

type AppStore = {
  language: Language
  setLanguage: (language: Language) => void
  role: UserRole
  setRole: (role: UserRole) => void
  isAdmin: boolean
  isCloud: boolean
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
  importLocalToCloud: () => Promise<number>
  /* Every district/city ever entered — survives deleting the customers that used it. */
  knownDistricts: string[]
  citiesFor: (district: string) => string[]
}

const AppContext = React.createContext<AppStore | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const cloudActive = auth.mode === 'cloud' && auth.status === 'ready' && !!db

  const [language, setLanguageState] = React.useState<Language>(() =>
    loadStored<Language>('promarwadi-language', 'en'),
  )
  const [localRole, setLocalRoleState] = React.useState<UserRole>(() =>
    loadStored<UserRole>('promarwadi-role', 'admin'),
  )
  // Cloud mode starts empty and fills from snapshots; demo mode uses local seeds
  const [customers, setCustomers] = React.useState<Customer[]>(() =>
    isFirebaseConfigured ? [] : loadStored('promarwadi-customers', seedCustomers),
  )
  const [entries, setEntries] = React.useState<LedgerEntry[]>(() =>
    isFirebaseConfigured ? [] : loadStored('promarwadi-entries', seedEntries),
  )
  const [locations, setLocations] = React.useState<LocationDirectory>(() =>
    isFirebaseConfigured
      ? emptyLocations
      : loadStored('promarwadi-locations', deriveLocations(seedCustomers)),
  )
  const [range, setRange] = React.useState<DateRange>(currentMonthRange)

  // Role is server-driven in cloud mode; the local toggle only exists in demo
  const role: UserRole = cloudActive ? (auth.profile?.role ?? 'staff') : localRole
  const actorName = cloudActive ? (auth.profile?.name || auth.user?.email || role) : role

  React.useEffect(() => {
    if (!cloudActive || !db) return
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) =>
      setCustomers(snapshot.docs.map((item) => item.data() as Customer)),
    )
    const unsubEntries = onSnapshot(collection(db, 'ledgerEntries'), (snapshot) =>
      setEntries(snapshot.docs.map((item) => item.data() as LedgerEntry)),
    )
    const unsubLocations = onSnapshot(doc(db, 'meta', 'locations'), (snapshot) =>
      setLocations(snapshot.exists() ? (snapshot.data() as LocationDirectory) : emptyLocations),
    )
    return () => {
      unsubCustomers()
      unsubEntries()
      unsubLocations()
    }
  }, [cloudActive])

  const setLanguage = React.useCallback((next: Language) => {
    setLanguageState(next)
    saveStored('promarwadi-language', next)
    document.documentElement.lang = next
  }, [])

  const setRole = React.useCallback((next: UserRole) => {
    setLocalRoleState(next)
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

  const recordLocation = React.useCallback(
    (district: string, city: string) => {
      if (!district.trim()) return
      if (cloudActive && db) {
        void setDoc(
          doc(db, 'meta', 'locations'),
          {
            districts: arrayUnion(district.trim()),
            ...(city.trim() ? { cities: { [district.trim()]: arrayUnion(city.trim()) } } : {}),
          },
          { merge: true },
        )
        return
      }
      setLocations((current) => {
        const next: LocationDirectory = {
          districts: unionInto(current.districts, district),
          cities: city.trim()
            ? { ...current.cities, [district.trim()]: unionInto(current.cities[district.trim()], city) }
            : current.cities,
        }
        saveStored('promarwadi-locations', next)
        return next
      })
    },
    [cloudActive],
  )

  const store: AppStore = {
    language,
    setLanguage,
    role,
    setRole,
    isAdmin: role === 'admin',
    isCloud: cloudActive,
    t: (key) => dictionary[language][key],
    fmt: (amount) => currency.format(amount),
    customers,
    entries,
    range,
    setRange,
    addCustomer: (input) => {
      const customer: Customer = { id: makeId('customer'), ...input, createdAt: today }
      if (cloudActive && db) void setDoc(doc(db, 'customers', customer.id), stripUndefined(customer))
      else persistCustomers([...customers, customer])
      recordLocation(input.district, input.city)
      return customer
    },
    updateCustomer: (id, input) => {
      const existing = customers.find((customer) => customer.id === id)
      if (!existing) return
      const next = { ...existing, ...input, updatedAt: today }
      if (cloudActive && db) void setDoc(doc(db, 'customers', id), stripUndefined(next))
      else persistCustomers(customers.map((customer) => (customer.id === id ? next : customer)))
      recordLocation(input.district, input.city)
    },
    deleteCustomer: (id) => {
      if (cloudActive && db) {
        const batch = writeBatch(db)
        batch.delete(doc(db, 'customers', id))
        entries
          .filter((entry) => entry.customerId === id)
          .forEach((entry) => batch.delete(doc(db!, 'ledgerEntries', entry.id)))
        void batch.commit()
      } else {
        persistCustomers(customers.filter((customer) => customer.id !== id))
        persistEntries(entries.filter((entry) => entry.customerId !== id))
      }
    },
    addEntry: (input) => {
      const entry: LedgerEntry = {
        id: makeId('entry'),
        ...input,
        createdAt: new Date().toISOString(),
        createdBy: actorName,
        isEdited: false,
        editCount: 0,
      }
      if (cloudActive && db) void setDoc(doc(db, 'ledgerEntries', entry.id), stripUndefined(entry))
      else persistEntries([...entries, entry])
    },
    updateEntry: (id, input) => {
      const existing = entries.find((entry) => entry.id === id)
      if (!existing) return
      const next: LedgerEntry = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
        updatedBy: actorName,
        isEdited: true,
        editCount: existing.editCount + 1,
      }
      // full replace (not merge) so cleared payment-mode fields actually go away
      if (cloudActive && db) void setDoc(doc(db, 'ledgerEntries', id), stripUndefined(next))
      else persistEntries(entries.map((entry) => (entry.id === id ? next : entry)))
    },
    deleteEntry: (id) => {
      if (cloudActive && db) void deleteDoc(doc(db, 'ledgerEntries', id))
      else persistEntries(entries.filter((entry) => entry.id !== id))
    },
    importLocalToCloud: async () => {
      if (!cloudActive || !db) return 0
      const localCustomers = loadStored<Customer[]>('promarwadi-customers', [])
      const localEntries = loadStored<LedgerEntry[]>('promarwadi-entries', [])
      const existingCustomerIds = new Set(customers.map((customer) => customer.id))
      const existingEntryIds = new Set(entries.map((entry) => entry.id))
      const batch = writeBatch(db)
      let count = 0
      for (const customer of localCustomers) {
        if (existingCustomerIds.has(customer.id)) continue
        batch.set(doc(db, 'customers', customer.id), stripUndefined(customer))
        count += 1
      }
      for (const entry of localEntries) {
        if (existingEntryIds.has(entry.id)) continue
        batch.set(doc(db, 'ledgerEntries', entry.id), stripUndefined(entry))
        count += 1
      }
      const localLocations = loadStored<LocationDirectory>('promarwadi-locations', emptyLocations)
      const hasLocations = localLocations.districts.length > 0
      if (hasLocations) {
        batch.set(
          doc(db, 'meta', 'locations'),
          {
            districts: arrayUnion(...localLocations.districts),
            cities: Object.fromEntries(
              Object.entries(localLocations.cities).map(([district, list]) => [district, arrayUnion(...list)]),
            ),
          },
          { merge: true },
        )
      }
      if (count > 0 || hasLocations) await batch.commit()
      return count
    },
    knownDistricts: [...locations.districts].sort((a, b) => a.localeCompare(b)),
    citiesFor: (district) => [...(locations.cities[district] ?? [])].sort((a, b) => a.localeCompare(b)),
  }

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>
}

export function useApp() {
  const store = React.useContext(AppContext)
  if (!store) throw new Error('useApp must be used inside AppProvider')
  return store
}
