/**
 * Seeds the local Firebase emulator with realistic test data.
 *
 * Usage:  1. npm run emulators   (in one terminal, wait for "All emulators ready")
 *         2. npm run seed        (in another terminal)
 *         3. npm run dev:emu     (app connected to the emulator)
 *
 * Sign in as  admin@promarwadi.test / admin123   (admin)
 *         or  staff@promarwadi.test / staff123   (collection staff)
 *
 * Talks straight to the emulator REST APIs so no extra npm packages are
 * needed. The Firestore emulator accepts `Authorization: Bearer owner` as a
 * rules bypass; the Auth emulator accepts any API key. Never run against
 * production — hosts are hardcoded to 127.0.0.1.
 */

const PROJECT_ID = 'demo-promarwadi'
const DATABASE_ID = 'default'
const AUTH_HOST = 'http://127.0.0.1:9099'
const FIRESTORE_HOST = 'http://127.0.0.1:8080'

// ---------- helpers ----------

function toValue(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } }
  if (typeof value === 'object') return { mapValue: { fields: toFields(value) } }
  throw new Error(`Unsupported value: ${value}`)
}

function toFields(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, toValue(v)]),
  )
}

async function setDocument(path, data) {
  const url = `${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!response.ok) throw new Error(`Firestore write ${path} failed: ${response.status} ${await response.text()}`)
}

async function createAuthUser(email, password, displayName) {
  const signUp = await fetch(
    `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    },
  )
  const body = await signUp.json()
  if (signUp.ok) return body.localId
  if (body?.error?.message === 'EMAIL_EXISTS') {
    // idempotent re-runs: fetch the existing uid via sign-in
    const signIn = await fetch(
      `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    )
    const existing = await signIn.json()
    if (signIn.ok) return existing.localId
  }
  throw new Error(`Auth user ${email} failed: ${JSON.stringify(body)}`)
}

function isoDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const today = isoDaysAgo(0)

// ---------- seed data ----------

const routes = [
  { id: 'route-bilara', name: 'Bilara Main Road' },
  { id: 'route-pipar', name: 'Pipar Bazaar' },
  { id: 'route-sojat', name: 'Sojat Line' },
  { id: 'route-balotra', name: 'Balotra Highway' },
]

const paymentAccounts = [
  { id: 'account-sbi', type: 'bank', name: 'SBI Current A/c', detail: 'A/c ...4521 · SBIN0003401', isDefault: true },
  { id: 'account-hdfc', type: 'bank', name: 'HDFC Business', detail: 'A/c ...8890 · HDFC0001275', isDefault: false },
  { id: 'account-gpay', type: 'upi', name: 'GPay', detail: 'promarwadi@okaxis', isDefault: false },
  { id: 'account-phonepe', type: 'upi', name: 'PhonePe', detail: '9876543210@ybl', isDefault: false },
]

// district → cities → customers, spread across routes
const customers = [
  { id: 'cust-01', name: 'Ramesh Footwear', phone: '9876543210', district: 'Jodhpur', city: 'Bilara', address: 'Main Bazaar', routeId: 'route-bilara', openingBalance: 12000 },
  { id: 'cust-02', name: 'Mahadev Traders', phone: '9876501234', district: 'Jodhpur', city: 'Bilara', address: 'Station Road', routeId: 'route-bilara', openingBalance: 4500 },
  { id: 'cust-03', name: 'Jain Brothers', phone: '9829011122', district: 'Jodhpur', city: 'Bilara', address: 'Sadar Market', routeId: 'route-bilara', openingBalance: 21500 },
  { id: 'cust-04', name: 'Shri Ganesh Vastra', phone: '9829033344', district: 'Jodhpur', city: 'Pipar', address: 'Clock Tower', routeId: 'route-pipar', openingBalance: 8700 },
  { id: 'cust-05', name: 'Pipar Cloth House', phone: '9414155667', district: 'Jodhpur', city: 'Pipar', address: 'Purana Bazaar', routeId: 'route-pipar', openingBalance: 15300 },
  { id: 'cust-06', name: 'Agarwal General Store', phone: '9414177889', district: 'Jodhpur', city: 'Pipar', routeId: 'route-pipar', openingBalance: 2100 },
  { id: 'cust-07', name: 'Shree Balaji Store', phone: '9988776655', district: 'Pali', city: 'Sojat', address: 'Mehndi Mandi', routeId: 'route-sojat', openingBalance: 8000 },
  { id: 'cust-08', name: 'Sojat Mehndi Bhandar', phone: '9950012345', district: 'Pali', city: 'Sojat', routeId: 'route-sojat', openingBalance: 32000 },
  { id: 'cust-09', name: 'Krishna Kirana', phone: '9950067890', district: 'Pali', city: 'Falna', address: 'Bus Stand Road', routeId: '', openingBalance: 5600 },
  { id: 'cust-10', name: 'Balotra Textiles', phone: '9414288990', district: 'Barmer', city: 'Balotra', address: 'Industrial Area', routeId: 'route-balotra', openingBalance: 45000 },
  { id: 'cust-11', name: 'Marwar Handicrafts', phone: '9414299001', district: 'Barmer', city: 'Balotra', routeId: 'route-balotra', openingBalance: 0 },
  { id: 'cust-12', name: 'New Style Garments', phone: '9829055660', district: 'Barmer', city: 'Balotra', address: 'Nehru Colony', routeId: 'route-balotra', openingBalance: 9800 },
]

// deterministic pseudo-random so re-runs produce identical books
function makeRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

function buildEntries() {
  const random = makeRandom(42)
  const modes = ['cash', 'cash', 'bank', 'upi'] // cash-heavy, like real collections
  const upiApps = ['GPay', 'PhonePe', 'Paytm']
  const bankNames = ['SBI', 'HDFC']
  const notes = ['New stock', 'Monthly collection', 'Part payment', 'Festival order', '']
  const entries = []
  let serial = 0
  for (const customer of customers) {
    const count = 3 + Math.floor(random() * 4) // 3–6 entries per customer
    for (let i = 0; i < count; i += 1) {
      serial += 1
      const daysAgo = Math.floor(random() * 75) // spread over ~2.5 months
      const isDebit = random() < 0.45
      const amount = (1 + Math.floor(random() * 40)) * 250
      const mode = isDebit ? undefined : modes[Math.floor(random() * modes.length)]
      entries.push({
        id: `entry-${String(serial).padStart(3, '0')}`,
        customerId: customer.id,
        date: isoDaysAgo(daysAgo),
        type: isDebit ? 'debit' : 'credit',
        amount,
        note: notes[Math.floor(random() * notes.length)] || undefined,
        paymentMode: mode,
        bankName: mode === 'bank' ? bankNames[Math.floor(random() * bankNames.length)] : undefined,
        upiApp: mode === 'upi' ? upiApps[Math.floor(random() * upiApps.length)] : undefined,
        createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        createdBy: random() < 0.7 ? 'Admin' : 'Suresh Kumar',
        isEdited: false,
        editCount: 0,
      })
    }
  }
  return entries
}

// ---------- run ----------

async function main() {
  console.log(`Seeding Firebase emulator (project ${PROJECT_ID})...`)

  const adminUid = await createAuthUser('admin@promarwadi.test', 'admin123', 'Admin')
  const staffUid = await createAuthUser('staff@promarwadi.test', 'staff123', 'Suresh Kumar')
  await setDocument(`users/${adminUid}`, { role: 'admin', name: 'Admin', email: 'admin@promarwadi.test' })
  await setDocument(`users/${staffUid}`, {
    role: 'staff',
    name: 'Suresh Kumar',
    email: 'staff@promarwadi.test',
    staffType: 'collection',
    allowedRouteIds: ['route-bilara', 'route-pipar'],
  })
  console.log(`  auth: admin@promarwadi.test/admin123 (${adminUid}), staff@promarwadi.test/staff123 (${staffUid})`)

  for (const route of routes) {
    await setDocument(`routes/${route.id}`, { ...route, createdAt: today })
  }
  console.log(`  routes: ${routes.length}`)

  for (const account of paymentAccounts) {
    await setDocument(`paymentAccounts/${account.id}`, { ...account, createdAt: new Date().toISOString() })
  }
  console.log(`  paymentAccounts: ${paymentAccounts.length} (default: SBI Current A/c)`)

  for (const customer of customers) {
    const { routeId, ...rest } = customer
    await setDocument(`customers/${customer.id}`, {
      ...rest,
      ...(routeId ? { routeId } : {}),
      createdAt: isoDaysAgo(90),
    })
  }
  console.log(`  customers: ${customers.length}`)

  const entries = buildEntries()
  for (const entry of entries) {
    await setDocument(`ledgerEntries/${entry.id}`, entry)
  }
  console.log(`  ledgerEntries: ${entries.length}`)

  const districts = [...new Set(customers.map((customer) => customer.district))]
  const cities = {}
  for (const customer of customers) {
    ;(cities[customer.district] ??= []).includes(customer.city) || cities[customer.district].push(customer.city)
  }
  await setDocument('meta/locations', { districts, cities })
  await setDocument('meta/preferences', { dateFormat: 'ddMMMyyyy', landingPage: 'highestBalance' })
  console.log('  meta: locations + preferences')

  console.log('Done. Start the app with: npm run dev:emu')
}

main().catch((error) => {
  console.error(error.message ?? error)
  console.error('\nIs the emulator running? Start it first with: npm run emulators')
  process.exit(1)
})
