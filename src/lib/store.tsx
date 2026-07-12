import * as React from 'react'
import { arrayUnion, collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore'
import { useAuth } from './auth'
import { createAuthAccount, db, isFirebaseConfigured } from './firebase'
import { dictionary, type TranslationKey } from './i18n'
import { seedCustomers, seedEntries, today } from './ledger'
import type { ParsedImportRow } from './csv-import'
import type {
  AppPreferences,
  Customer,
  DateRange,
  EntryType,
  ImportBatch,
  Language,
  LedgerEntry,
  LocationDirectory,
  PaymentAccount,
  PaymentAccountType,
  PaymentMode,
  Route,
  StaffAccount,
  StaffType,
  UserProfile,
  UserRole,
} from './types'
import { defaultPreferences } from './types'
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
  /* Empty string means "no route" — normalized to undefined before saving. */
  routeId: string
  openingBalance: number
}

export type PaymentAccountInput = {
  type: PaymentAccountType
  name: string
  detail: string
}

export type StaffInput = {
  name: string
  phone: string
  staffType: StaffType
  allowedRouteIds: string[]
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
  /* CSV bulk entry — admin-only, gated by preferences.csvImportEnabled in the UI. */
  importBatches: ImportBatch[]
  importEntries: (input: {
    customerId: string
    fileName: string
    fileHash: string
    rows: ParsedImportRow[]
  }) => void
  reverseImportBatch: (batchId: string) => void
  /* Every district/city ever entered — survives deleting the customers that used it. */
  knownDistricts: string[]
  citiesFor: (district: string) => string[]
  routes: Route[]
  addRoute: (name: string) => Route
  updateRoute: (id: string, name: string) => void
  deleteRoute: (id: string) => void
  routeName: (routeId: string | undefined) => string
  assignCustomersToRoute: (customerIds: string[], routeId: string) => void
  paymentAccounts: PaymentAccount[]
  defaultPaymentAccount: PaymentAccount | null
  addPaymentAccount: (input: PaymentAccountInput) => void
  updatePaymentAccount: (id: string, input: PaymentAccountInput) => void
  deletePaymentAccount: (id: string) => void
  setDefaultPaymentAccount: (id: string) => void
  /* Admin-only, cloud-only: staff account management. The list is empty for
     non-admins (the users collection subscription never starts). */
  staffAccounts: StaffAccount[]
  addStaff: (email: string, password: string, input: StaffInput) => Promise<void>
  updateStaff: (uid: string, input: StaffInput) => void
  deleteStaff: (uid: string) => void
  /* Cloud-only: any signed-in user renames themselves (name field only —
     Firestore rules block touching role/routes on your own profile). */
  updateOwnName: (name: string) => void
  /* Staff only: routes allocated to the signed-in account. */
  allowedRouteIds: string[]
  preferences: AppPreferences
  setPreferences: (next: Partial<AppPreferences>) => void
  /* Firestore error code of the most recent failed cloud write ('' = none).
     Writes are fire-and-forget for snappy UI, so failures land here instead
     of dying silently as unhandled rejections. */
  syncError: string
  clearSyncError: () => void
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
  const [routes, setRoutes] = React.useState<Route[]>(() =>
    isFirebaseConfigured ? [] : loadStored<Route[]>('promarwadi-routes', []),
  )
  const [paymentAccounts, setPaymentAccounts] = React.useState<PaymentAccount[]>(() =>
    isFirebaseConfigured ? [] : loadStored<PaymentAccount[]>('promarwadi-payment-accounts', []),
  )
  const [importBatches, setImportBatches] = React.useState<ImportBatch[]>(() =>
    isFirebaseConfigured ? [] : loadStored<ImportBatch[]>('promarwadi-import-batches', []),
  )
  // Preferences load from localStorage in both modes so the UI doesn't flash
  // defaults while the cloud snapshot arrives; cloud stays the source of truth.
  const [preferences, setPreferencesState] = React.useState<AppPreferences>(() => ({
    ...defaultPreferences,
    ...loadStored<Partial<AppPreferences>>('promarwadi-preferences', {}),
  }))
  const [staffAccounts, setStaffAccounts] = React.useState<StaffAccount[]>([])
  const [range, setRange] = React.useState<DateRange>(currentMonthRange)
  const [syncError, setSyncError] = React.useState('')

  const cloudWrite = React.useCallback((write: Promise<unknown>) => {
    write.catch((error: unknown) => {
      const code = (error as { code?: string })?.code ?? ''
      setSyncError(code || 'unknown')
    })
  }, [])

  // Role is server-driven in cloud mode; the local toggle only exists in demo
  const role: UserRole = cloudActive ? (auth.profile?.role ?? 'staff') : localRole
  const actorName = cloudActive ? (auth.profile?.name || auth.user?.email || role) : role

  /* Staff scoping: in cloud mode a staff account only sees the routes it was
     allocated and the customers/entries inside them. Applied here, centrally,
     so every screen is restricted automatically. Demo mode stays unscoped
     (its role toggle has no per-user allocation). */
  const allowedRouteIds = React.useMemo(
    () => auth.profile?.allowedRouteIds ?? [],
    [auth.profile],
  )
  const staffScoped = cloudActive && role === 'staff'
  const visibleCustomers = React.useMemo(
    () =>
      staffScoped
        ? customers.filter((customer) => customer.routeId && allowedRouteIds.includes(customer.routeId))
        : customers,
    [customers, staffScoped, allowedRouteIds],
  )
  const visibleEntries = React.useMemo(() => {
    if (!staffScoped) return entries
    const ids = new Set(visibleCustomers.map((customer) => customer.id))
    return entries.filter((entry) => ids.has(entry.customerId))
  }, [entries, staffScoped, visibleCustomers])
  const visibleRoutes = React.useMemo(
    () => (staffScoped ? routes.filter((route) => allowedRouteIds.includes(route.id)) : routes),
    [routes, staffScoped, allowedRouteIds],
  )

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
    const unsubRoutes = onSnapshot(collection(db, 'routes'), (snapshot) =>
      setRoutes(snapshot.docs.map((item) => item.data() as Route)),
    )
    const unsubAccounts = onSnapshot(collection(db, 'paymentAccounts'), (snapshot) =>
      setPaymentAccounts(snapshot.docs.map((item) => item.data() as PaymentAccount)),
    )
    const unsubPreferences = onSnapshot(doc(db, 'meta', 'preferences'), (snapshot) => {
      if (!snapshot.exists()) return
      const next = { ...defaultPreferences, ...(snapshot.data() as Partial<AppPreferences>) }
      setPreferencesState(next)
      saveStored('promarwadi-preferences', next)
    })
    return () => {
      unsubCustomers()
      unsubEntries()
      unsubLocations()
      unsubRoutes()
      unsubAccounts()
      unsubPreferences()
    }
  }, [cloudActive])

  // Firestore permanently terminates a listener that errors (e.g. rules were
  // deployed after the page loaded → permission-denied); it never retries on
  // its own, leaving the list stuck empty until a full reload. Bumping this
  // tick resubscribes the admin-only listeners below after a pause.
  const [adminListenerRetry, setAdminListenerRetry] = React.useState(0)
  const retryAdminListeners = React.useCallback(() => {
    window.setTimeout(() => setAdminListenerRetry((tick) => tick + 1), 15000)
  }, [])

  // users collection is admin-readable only — staff subscribing would get
  // permission-denied on the whole query, so gate on the live role
  React.useEffect(() => {
    if (!cloudActive || !db || role !== 'admin') {
      setStaffAccounts([])
      return
    }
    return onSnapshot(
      collection(db, 'users'),
      (snapshot) =>
        setStaffAccounts(
          snapshot.docs.map((item) => ({ uid: item.id, ...(item.data() as UserProfile) })),
        ),
      retryAdminListeners,
    )
  }, [cloudActive, role, adminListenerRetry, retryAdminListeners])

  // importBatches is admin-only in Firestore rules — same gating as staffAccounts
  React.useEffect(() => {
    if (!cloudActive || !db || role !== 'admin') {
      setImportBatches([])
      return
    }
    return onSnapshot(
      collection(db, 'importBatches'),
      (snapshot) => setImportBatches(snapshot.docs.map((item) => item.data() as ImportBatch)),
      retryAdminListeners,
    )
  }, [cloudActive, role, adminListenerRetry, retryAdminListeners])

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

  const persistRoutes = React.useCallback((next: Route[]) => {
    setRoutes(next)
    saveStored('promarwadi-routes', next)
  }, [])

  const persistAccounts = React.useCallback((next: PaymentAccount[]) => {
    setPaymentAccounts(next)
    saveStored('promarwadi-payment-accounts', next)
  }, [])

  const persistImportBatches = React.useCallback((next: ImportBatch[]) => {
    setImportBatches(next)
    saveStored('promarwadi-import-batches', next)
  }, [])

  const recordLocation = React.useCallback(
    (district: string, city: string) => {
      if (!district.trim()) return
      if (cloudActive && db) {
        cloudWrite(
          setDoc(
            doc(db, 'meta', 'locations'),
            {
              districts: arrayUnion(district.trim()),
              ...(city.trim() ? { cities: { [district.trim()]: arrayUnion(city.trim()) } } : {}),
            },
            { merge: true },
          ),
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
    [cloudActive, cloudWrite],
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
    customers: visibleCustomers,
    entries: visibleEntries,
    range,
    setRange,
    addCustomer: (input) => {
      const customer: Customer = {
        id: makeId('customer'),
        ...input,
        routeId: input.routeId.trim() || undefined,
        createdAt: today,
      }
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'customers', customer.id), stripUndefined(customer)))
      else persistCustomers([...customers, customer])
      recordLocation(input.district, input.city)
      return customer
    },
    updateCustomer: (id, input) => {
      const existing = customers.find((customer) => customer.id === id)
      if (!existing) return
      const next = { ...existing, ...input, routeId: input.routeId.trim() || undefined, updatedAt: today }
      // full replace so a cleared route actually goes away in cloud mode
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'customers', id), stripUndefined(next)))
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
        cloudWrite(batch.commit())
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
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'ledgerEntries', entry.id), stripUndefined(entry)))
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
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'ledgerEntries', id), stripUndefined(next)))
      else persistEntries(entries.map((entry) => (entry.id === id ? next : entry)))
    },
    deleteEntry: (id) => {
      if (cloudActive && db) cloudWrite(deleteDoc(doc(db, 'ledgerEntries', id)))
      else persistEntries(entries.filter((entry) => entry.id !== id))
    },
    importEntries: ({ customerId, fileName, fileHash, rows }) => {
      const batchId = makeId('import')
      const nowIso = new Date().toISOString()
      const newEntries: LedgerEntry[] = []
      rows.forEach((row) => {
        if (row.bill) {
          newEntries.push({
            id: makeId('entry'),
            customerId,
            date: row.date,
            type: 'debit',
            amount: row.bill,
            note: row.note,
            importBatchId: batchId,
            createdAt: nowIso,
            createdBy: actorName,
            isEdited: false,
            editCount: 0,
          })
        }
        if (row.cash) {
          newEntries.push({
            id: makeId('entry'),
            customerId,
            date: row.date,
            type: 'credit',
            amount: row.cash,
            note: row.note,
            paymentMode: 'cash',
            importBatchId: batchId,
            createdAt: nowIso,
            createdBy: actorName,
            isEdited: false,
            editCount: 0,
          })
        }
      })
      const batch: ImportBatch = {
        id: batchId,
        customerId,
        fileName,
        rowCount: rows.length,
        entryCount: newEntries.length,
        totalBill: rows.reduce((sum, row) => sum + (row.bill ?? 0), 0),
        totalCash: rows.reduce((sum, row) => sum + (row.cash ?? 0), 0),
        entryIds: newEntries.map((entry) => entry.id),
        fileHash,
        status: 'active',
        createdAt: nowIso,
        createdBy: actorName,
      }
      if (cloudActive && db) {
        const batchWrite = writeBatch(db)
        newEntries.forEach((entry) => batchWrite.set(doc(db!, 'ledgerEntries', entry.id), stripUndefined(entry)))
        batchWrite.set(doc(db!, 'importBatches', batchId), stripUndefined(batch))
        cloudWrite(batchWrite.commit())
      } else {
        persistEntries([...entries, ...newEntries])
        persistImportBatches([...importBatches, batch])
      }
    },
    reverseImportBatch: (batchId) => {
      const batch = importBatches.find((item) => item.id === batchId)
      if (!batch || batch.status === 'reversed') return
      const nextBatch: ImportBatch = {
        ...batch,
        status: 'reversed',
        reversedAt: new Date().toISOString(),
        reversedBy: actorName,
      }
      if (cloudActive && db) {
        const batchWrite = writeBatch(db)
        batch.entryIds.forEach((entryId) => batchWrite.delete(doc(db!, 'ledgerEntries', entryId)))
        batchWrite.set(doc(db!, 'importBatches', batchId), stripUndefined(nextBatch))
        cloudWrite(batchWrite.commit())
      } else {
        const entryIds = new Set(batch.entryIds)
        persistEntries(entries.filter((entry) => !entryIds.has(entry.id)))
        persistImportBatches(importBatches.map((item) => (item.id === batchId ? nextBatch : item)))
      }
    },
    importLocalToCloud: async () => {
      if (!cloudActive || !db) return 0
      const localCustomers = loadStored<Customer[]>('promarwadi-customers', [])
      const localEntries = loadStored<LedgerEntry[]>('promarwadi-entries', [])
      const localRoutes = loadStored<Route[]>('promarwadi-routes', [])
      const localAccounts = loadStored<PaymentAccount[]>('promarwadi-payment-accounts', [])
      const existingCustomerIds = new Set(customers.map((customer) => customer.id))
      const existingEntryIds = new Set(entries.map((entry) => entry.id))
      const existingRouteIds = new Set(routes.map((route) => route.id))
      const existingAccountIds = new Set(paymentAccounts.map((account) => account.id))
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
      for (const route of localRoutes) {
        if (existingRouteIds.has(route.id)) continue
        batch.set(doc(db, 'routes', route.id), stripUndefined(route))
        count += 1
      }
      for (const account of localAccounts) {
        if (existingAccountIds.has(account.id)) continue
        // cloud may already have a default — never import a second one
        batch.set(
          doc(db, 'paymentAccounts', account.id),
          stripUndefined({ ...account, isDefault: paymentAccounts.length === 0 && account.isDefault }),
        )
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
    routes: [...visibleRoutes].sort((a, b) => a.name.localeCompare(b.name)),
    addRoute: (name) => {
      const route: Route = { id: makeId('route'), name: name.trim(), createdAt: today }
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'routes', route.id), stripUndefined(route)))
      else persistRoutes([...routes, route])
      return route
    },
    updateRoute: (id, name) => {
      const existing = routes.find((route) => route.id === id)
      if (!existing || !name.trim()) return
      const next: Route = { ...existing, name: name.trim(), updatedAt: today }
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'routes', id), stripUndefined(next)))
      else persistRoutes(routes.map((route) => (route.id === id ? next : route)))
    },
    deleteRoute: (id) => {
      // detach the route from its customers so no dangling routeId remains
      const assigned = customers.filter((customer) => customer.routeId === id)
      if (cloudActive && db) {
        const batch = writeBatch(db)
        batch.delete(doc(db, 'routes', id))
        assigned.forEach((customer) =>
          batch.set(doc(db!, 'customers', customer.id), stripUndefined({ ...customer, routeId: undefined })),
        )
        cloudWrite(batch.commit())
      } else {
        persistRoutes(routes.filter((route) => route.id !== id))
        persistCustomers(
          customers.map((customer) =>
            customer.routeId === id ? { ...customer, routeId: undefined } : customer,
          ),
        )
      }
    },
    routeName: (routeId) => routes.find((route) => route.id === routeId)?.name ?? '',
    assignCustomersToRoute: (customerIds, routeId) => {
      // bulk move existing customers onto a route (or off any route when
      // routeId is '') — e.g. onboarding a newly created route
      const ids = new Set(customerIds)
      const nextRouteId = routeId || undefined
      if (cloudActive && db) {
        const batch = writeBatch(db)
        customers
          .filter((customer) => ids.has(customer.id))
          .forEach((customer) =>
            batch.set(
              doc(db!, 'customers', customer.id),
              stripUndefined({ ...customer, routeId: nextRouteId, updatedAt: today }),
            ),
          )
        cloudWrite(batch.commit())
      } else {
        persistCustomers(
          customers.map((customer) =>
            ids.has(customer.id) ? { ...customer, routeId: nextRouteId, updatedAt: today } : customer,
          ),
        )
      }
    },
    importBatches: [...importBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    paymentAccounts: [...paymentAccounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    defaultPaymentAccount: paymentAccounts.find((account) => account.isDefault) ?? null,
    addPaymentAccount: (input) => {
      const account: PaymentAccount = {
        id: makeId('account'),
        type: input.type,
        name: input.name.trim(),
        detail: input.detail.trim() || undefined,
        // the first account added becomes the default automatically
        isDefault: paymentAccounts.length === 0,
        createdAt: new Date().toISOString(),
      }
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'paymentAccounts', account.id), stripUndefined(account)))
      else persistAccounts([...paymentAccounts, account])
    },
    updatePaymentAccount: (id, input) => {
      const existing = paymentAccounts.find((account) => account.id === id)
      if (!existing) return
      const next: PaymentAccount = {
        ...existing,
        type: input.type,
        name: input.name.trim(),
        detail: input.detail.trim() || undefined,
        updatedAt: new Date().toISOString(),
      }
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'paymentAccounts', id), stripUndefined(next)))
      else persistAccounts(paymentAccounts.map((account) => (account.id === id ? next : account)))
    },
    deletePaymentAccount: (id) => {
      const remaining = paymentAccounts.filter((account) => account.id !== id)
      const wasDefault = paymentAccounts.find((account) => account.id === id)?.isDefault
      // never leave accounts around without a default — promote the oldest one
      const promoted = wasDefault && remaining.length > 0 ? remaining[0] : null
      if (cloudActive && db) {
        const batch = writeBatch(db)
        batch.delete(doc(db, 'paymentAccounts', id))
        if (promoted) batch.set(doc(db!, 'paymentAccounts', promoted.id), { ...promoted, isDefault: true })
        cloudWrite(batch.commit())
      } else {
        persistAccounts(
          remaining.map((account) =>
            promoted && account.id === promoted.id ? { ...account, isDefault: true } : account,
          ),
        )
      }
    },
    setDefaultPaymentAccount: (id) => {
      if (cloudActive && db) {
        const batch = writeBatch(db)
        paymentAccounts.forEach((account) => {
          if (account.isDefault !== (account.id === id)) {
            batch.set(doc(db!, 'paymentAccounts', account.id), stripUndefined({ ...account, isDefault: account.id === id }))
          }
        })
        cloudWrite(batch.commit())
      } else {
        persistAccounts(paymentAccounts.map((account) => ({ ...account, isDefault: account.id === id })))
      }
    },
    staffAccounts: [...staffAccounts]
      .filter((account) => account.role === 'staff')
      .sort((a, b) => (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? '')),
    addStaff: async (email, password, input) => {
      if (!cloudActive || !db) throw new Error('cloud-only')
      // both steps awaited (not cloudWrite) so the sheet can show a precise error
      const uid = await createAuthAccount(email, password)
      const profile: UserProfile = {
        role: 'staff',
        name: input.name.trim(),
        email: email.trim(),
        phone: input.phone.trim() || undefined,
        staffType: input.staffType,
        allowedRouteIds: input.allowedRouteIds,
      }
      await setDoc(doc(db, 'users', uid), stripUndefined(profile))
    },
    updateStaff: (uid, input) => {
      const existing = staffAccounts.find((account) => account.uid === uid)
      if (!existing || !cloudActive || !db) return
      const next: UserProfile = {
        role: existing.role,
        name: input.name.trim(),
        email: existing.email,
        phone: input.phone.trim() || undefined,
        staffType: input.staffType,
        allowedRouteIds: input.allowedRouteIds,
      }
      // full replace so a cleared phone actually goes away
      cloudWrite(setDoc(doc(db, 'users', uid), stripUndefined(next)))
    },
    deleteStaff: (uid) => {
      // removes the profile doc — access revoked instantly (auth.tsx watches it
      // live); the Firebase Auth login remains but lands on the no-access screen
      if (!cloudActive || !db) return
      cloudWrite(deleteDoc(doc(db, 'users', uid)))
    },
    updateOwnName: (name) => {
      const trimmed = name.trim()
      if (!trimmed || !cloudActive || !db || !auth.user) return
      // merge keeps role/routes intact; auth.tsx's live profile watch picks it up
      cloudWrite(setDoc(doc(db, 'users', auth.user.uid), { name: trimmed }, { merge: true }))
    },
    allowedRouteIds,
    preferences,
    setPreferences: (next) => {
      const merged = { ...preferences, ...next }
      setPreferencesState(merged)
      saveStored('promarwadi-preferences', merged)
      if (cloudActive && db) cloudWrite(setDoc(doc(db, 'meta', 'preferences'), merged, { merge: true }))
    },
    syncError,
    clearSyncError: () => setSyncError(''),
  }

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>
}

export function useApp() {
  const store = React.useContext(AppContext)
  if (!store) throw new Error('useApp must be used inside AppProvider')
  return store
}
