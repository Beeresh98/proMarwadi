# Phase Progress Log

Multi-phase upgrade of ProMarwadi (React 19 + Vite + TS + Tailwind 4, Firebase Auth/Firestore with localStorage demo-mode fallback). This file is the hand-off document between phases — read it fully before resuming work in a new context window.

## Workflow rules (do not skip)

- Complete exactly ONE phase, update this file, start the dev server, then STOP and ask the user to test. Only continue when the user types "Proceed".
- Reuse existing UI components (`Button`, `Sheet`, `ConfirmDialog`, `Picker`, `SegmentedControl`, `Field`/`Input`, `DatePicker`, card styling `rounded-[var(--radius-card)] border border-border bg-card p-4`). No new UI libraries. Keep the teal fintech aesthetic and existing subtle animations (`animate-fade-up`, `stagger`, `pressable`).
- Every user-facing string goes into BOTH `en` and `hi` dictionaries in `src/lib/i18n.ts`.
- Every store write must handle BOTH cloud mode (Firestore) and demo mode (localStorage) — follow the existing dual-path pattern in `src/lib/store.tsx`.
- `jspdf` + `jspdf-autotable` power the PDF exports; `recharts` powers the analytics charts. No other UI/chart libraries.

## Phase 1: Settings Hub, Routes CRUD, Bank/UPI, Preferences — ✅ DONE (2026-07-06)

### Schema changes (`src/lib/types.ts`)

- `Route { id, name, createdAt, updatedAt? }` — Firestore collection `routes`, demo key `promarwadi-routes`.
- `PaymentAccount { id, type: 'bank'|'upi', name, detail?, isDefault, createdAt, updatedAt? }` — collection `paymentAccounts`, demo key `promarwadi-payment-accounts`. Exactly one default at a time (store-enforced).
- `AppPreferences { dateFormat: 'ddmmyyyy'|'ddMMMyyyy', landingPage: 'highestBalance'|'lastEntries' }` + exported `defaultPreferences` (ddMMMyyyy/highestBalance = original app behavior). Cloud doc `meta/preferences`, mirrored to localStorage key `promarwadi-preferences` in both modes (cache so UI doesn't flash defaults).
- `Customer.routeId?: string` — optional; absent on old data; `''` normalized to `undefined` before save.

### Store changes (`src/lib/store.tsx`)

- New state + Firestore `onSnapshot` subscriptions for `routes`, `paymentAccounts`, `meta/preferences`.
- New API on `useApp()`: `routes` (name-sorted), `addRoute(name) → Route`, `updateRoute(id, name)`, `deleteRoute(id)` (batch-detaches `routeId` from assigned customers), `routeName(routeId)`; `paymentAccounts` (createdAt-sorted), `defaultPaymentAccount`, `addPaymentAccount`, `updatePaymentAccount` (no UI yet — reserved), `deletePaymentAccount` (promotes oldest remaining to default if the default was deleted), `setDefaultPaymentAccount(id)` (batch flips flags); `preferences`, `setPreferences(partial)`.
- First payment account added automatically becomes default.
- `CustomerInput` gained required `routeId: string` field. `addCustomer`/`updateCustomer` normalize `''` → `undefined` (cloud `setDoc` is full-replace, so clearing a route works).
- `importLocalToCloud` now also uploads local routes/paymentAccounts (never imports a second default).

### UI changes

- `src/screens/settings.tsx`: three new admin-only sections between Language and Backups — `RoutesSection` (inline add input + list with pencil-edit-in-place, trash + ConfirmDialog, per-route customer count), `BanksSection` (bank/upi SegmentedControl + name/detail inputs, list with default badge / star-to-set-default / delete + ConfirmDialog), `PreferencesSection` (dateFormat SegmentedControl showing live-formatted today's date; landingPage SegmentedControl).
- `src/components/app/customer-sheet.tsx`: new Route field (Picker: "No route" + routes + "+ Add new route" action that swaps to a text input, same pattern as `LocationField`). Typing a new route name creates the route on save via `addRoute`.
- `src/components/ui/date-picker.tsx`: `formatDisplayDate(value, language, format?: DateFormatPref)` — `'ddmmyyyy'` renders `06/07/2026`, default `'ddMMMyyyy'` keeps original `6 Jul 2026`. `DatePicker` accepts optional `dateFormat` prop.
- Date-format preference wired through every date display/picker: `collection.tsx`, `ledger.tsx`, `reports.tsx`, `entry-sheet.tsx`, `home.tsx`.
- `src/screens/home.tsx`: landing preference switches the list section — `highestBalance` = original top-5-by-|balance| customer list; `lastEntries` = last 10 ledger entries (date+createdAt desc) with colored ± amounts, tap opens the customer ledger.
- `src/lib/i18n.ts`: ~30 new keys (routes/banks/preferences), en + hi.

### Phase 1 addendum: rules fix, sync-error toast, emulator + seed (2026-07-06)

Root cause of "adding anything silently fails": `firestore.rules` (in repo, deployed to prod) ends with a deny-all catch-all, so the new `routes`/`paymentAccounts`/`meta/preferences` paths were `permission-denied`; and all cloud writes were `void setDoc(...)` with no `.catch`, so nothing surfaced in the UI.

- **`firestore.rules` updated** with `routes`, `paymentAccounts`, `meta/preferences` blocks (staff read, admin write). **NOT yet deployed to production** — deploy with `firebase deploy --only firestore:rules --project promarwadi-63230`.
- **Sync-error toast**: store exposes `syncError`/`clearSyncError`; every fire-and-forget cloud write goes through `cloudWrite()` which catches rejections; `SyncErrorToast` in `App.tsx` shows a dismissible red banner with the Firestore error code. New i18n keys `syncFailed`, `syncFailedHint`.
- **Emulator workflow** (never touches production): `npm run emulators` (firebase-tools 15.x global, Java 21 present) → `npm run seed` → `npm run dev:emu`. Config: `firebase.json` (auth 9099, firestore 8080, UI 4000), `.env.emulator` (demo-promarwadi project id + `VITE_USE_EMULATORS=true`), `src/lib/firebase.ts` connects via `connectAuthEmulator`/`connectFirestoreEmulator` when the flag is set. `.claude/launch.json` has a `dev-emu` configuration.
- **Seed script** `scripts/seed-emulator.mjs` (no new deps, raw emulator REST): admin@promarwadi.test/admin123, staff@promarwadi.test/staff123 (+ `users/{uid}` profiles), 4 routes, 4 payment accounts (SBI default), 12 customers across 3 districts/5 cities (one intentionally route-less), ~53 deterministic ledger entries over ~75 days with mixed payment modes, `meta/locations` + `meta/preferences`. Idempotent (re-runs reuse existing auth users; doc writes are PATCH upserts). Emulator data is in-memory — re-seed after every emulator restart.
- Verified end-to-end against the emulator: admin sign-in, seeded data rendering, route add round-trips through Firestore snapshot listeners, zero console errors.

### ⚠️ Pending / notes for next phases

- **Deploy updated `firestore.rules` to production** (command above) before using new features on real data.
- `updatePaymentAccount` exists in the store but has no UI (delete + re-add covers editing for now).
- Route is not yet displayed on customer list rows / ledger header — Phase 2 (staff route restriction) and Phase 4 (route filter on collection PDF) will surface it.
- Demo seeds contain no routes/accounts; add via Settings to test.

## Phase 2: Role-Based Access & Staff Routing — ✅ DONE (2026-07-06)

### Schema (`src/lib/types.ts`)

- `UserProfile` gained `staffType?: StaffType` and `allowedRouteIds?: string[]` (staff only). `staffTypes = ['collection']` (extensible; label i18n key `staffTypeCollection` = "Collection Staff", the default). `StaffAccount = UserProfile & { uid }` for the admin list.

### Auth-account creation without losing the admin session (`src/lib/firebase.ts`)

- `createAuthAccount(email, password)` runs `createUserWithEmailAndPassword` on a **throwaway secondary Firebase app** (`initializeApp(config, 'account-factory-…')`), signs the new user out of that instance, deletes the app, returns the uid. Admin's session on the primary app is untouched (verified).
- Self-healing: on `auth/email-already-in-use` it tries `signInWithEmailAndPassword` with the given credentials — recovers orphans from a previously interrupted create (auth user made, profile write failed).

### Rules (`firestore.rules`)

- `users/{userId}`: `allow create, update, delete: if isAdmin() && request.auth.uid != userId` — admin manages staff from the app but can never touch their own doc (no self-demotion/lockout). **Deploy to prod before using: `firebase deploy --only firestore:rules --project promarwadi-63230`.**
- ⚠️ **Emulator gotcha (Windows)**: editing `firestore.rules` while the emulator runs logs "Rules updated" but may still serve the OLD rules — **restart the emulator + re-seed after any rules change** (bit us: staff profile writes got permission-denied citing old line numbers).

### Store (`src/lib/store.tsx`)

- `staffAccounts` (role==='staff', sorted) fed by a `users` collection subscription that only starts when the live role is admin (staff subscribing would permission-deny the whole query).
- `addStaff(email, password, {name, staffType, allowedRouteIds})` — awaited (not `cloudWrite`) so the sheet can map auth error codes; `updateStaff(uid, input)` (preserves role/email/phone), `deleteStaff(uid)` (deletes profile doc → access revoked live via auth.tsx's own-profile subscription; the Firebase Auth login remains and lands on the no-access screen — full Auth deletion needs the console/Admin SDK).
- **Central staff scoping**: when cloud + role==='staff', the store's exported `customers`/`entries`/`routes` are filtered to `auth.profile.allowedRouteIds` (customers by `routeId`, entries by visible customer ids, routes to allocated). Every screen is automatically restricted. `allowedRouteIds` also exported. Demo mode stays unscoped (its role toggle has no allocation). ⚠️ Security note: this is client-side enforcement; Firestore rules still let any profiled user read all docs (same trust model as pre-Phase-2). Server-side per-route read rules would need query-scoped reads + denormalized routeId on entries — revisit if staff devices are untrusted.

### UI

- `src/screens/settings.tsx`: `StaffSection` (admin + cloud only, between Routes and Banks) — list with name/type/route-names, pencil→`StaffSheet`, trash→ConfirmDialog; `StaffSheet` handles create (name/email/password + staff type SegmentedControl + multi-select route checklist) and edit (email shown read-only, no password change — use Forgot password); maps `auth/email-already-in-use|weak-password|invalid-email` to i18n errors, logs unexpected ones. `YourRoutesSection` for staff (read-only allocated routes + customer counts).
- `src/App.tsx`: staff `allowedTabs` now `['customers', 'collection', 'settings']` (default landing stays collection).
- `src/screens/customers.tsx`: add-customer buttons admin-only.
- `src/screens/ledger.tsx` already gated customer/entry edit/delete behind `isAdmin` — unchanged.
- ~15 new i18n keys (en + hi).

### Seed

- `scripts/seed-emulator.mjs`: staff@promarwadi.test now seeds with `staffType: 'collection'`, `allowedRouteIds: ['route-bilara', 'route-pipar']`.

### Verified in emulator

Admin created a staff account via the UI (Ravi Sharma / Sojat Line) — admin session intact, account listed immediately. Staff sign-in shows only Customers/Collection/Settings tabs, exactly the 6 Bilara+Pipar customers (of 12), no add-customer button, and "Your routes" in Settings. Zero new console errors.

## Interim fixes from user testing (2026-07-07)

1. **Entry sheet customer lock** (`entry-sheet.tsx`): when opened from a customer's ledger (`draft.customerId` set) or when editing, the customer renders as read-only text instead of a swappable picker.
2. **Ledger latest-first** (`ledger.tsx`): `ledgerRows` stays chronological (running balance + PDF need it); the on-screen list renders `displayRows = [...rows].reverse()`.
3. **Bank/UPI from configured accounts** (`entry-sheet.tsx`): freeform bank-name input and the hardcoded `upiApps` list are gone (`upiApps`/`UpiApp` removed from types.ts). Bank/UPI fields are Pickers over `paymentAccounts` (detail shown as hint); the admin's default account preselects both on sheet open and on mode-switch (falls back to that mode's first account; freeform Input only if no accounts of that type are configured yet). `bankName`/`upiApp` on entries still store the account *name* — old data stays compatible.
4. **Staff phone + email editing** (`settings.tsx`, `store.tsx`): `StaffInput` gained `phone` (editable on create + edit; full-replace write so clearing works). Login email cannot be changed via client SDK, so "Change login email" in the edit sheet (user chose delete+recreate) creates the replacement login first via `addStaff`, then `deleteStaff(old uid)` — never leaves zero logins. New i18n keys: changeEmail, changeEmailHint, newEmail, newPassword, cancelChangeEmail.

## Phase 3: Staff Collection Workflow — ✅ DONE (2026-07-07)

### Staff customer profile (`src/screens/ledger.tsx`)

- Staff opening a customer sees: balance hero (unchanged), a **Last 10 / Date range** SegmentedControl, and the transaction list. "Last 10" (default) shows the 10 most recent entries all-time; "Date range" reveals the From/To pickers and uses the shared store range. Both render latest-first with correct running balances (`ledgerRows` over an all-time range, `.slice(-10).reverse()`).
- Hidden for staff: PDF export, customer edit/delete, entry edit/delete (already gated), and the Bill− button. The only action is a full-width **Receive payment** (credit-styled) button.

### Receive Payment flow (`src/components/app/entry-sheet.tsx`)

- For staff the sheet is titled "Receive payment", the Bill/Received type toggle is hidden, and type is forced to `'credit'` on init. Customer is locked (interim fix 1). Payment mode + account preselect from the admin's default (interim fix 3, satisfies the Phase-3 default-mode requirement).
- Balances need no extra wiring: they derive from entries (`customerBalance`), and Firestore snapshots update every screen live — verified: staff saved ₹500 Bank/SBI, balance went ₹12,250 → ₹11,750 instantly and the entry appeared at the top.

### Rules (`firestore.rules`)

- `ledgerEntries`: `allow create: if isAdmin() || (isStaff() && request.resource.data.type == 'credit')` — staff payments allowed, staff debits PERMISSION_DENIED (verified via REST probe). **Remember: emulator restart + re-seed after rules edits; prod deploy still pending.**

### i18n

- New keys: `receivePayment`, `last10`, `dateRange` (en + hi).

## Phase 4: Analytics, Advanced PDFs & Pagination — ✅ DONE (2026-07-07)

User expanded scope: comprehensive analytics (daily/monthly/employee/customer-frequency), everything downloadable.

### New: `src/lib/analytics.ts` (pure aggregation, fully unit-testable)

- `periodBuckets(entries, grain)` — daily (last 30 days) / weekly (12 Mon-start weeks) / monthly (12 months) / yearly (all years on record); each bucket = `{label, from, to, debit, credit, count}`.
- `paymentModeSplit(entries, from, to)` — credits by cash/bank/upi; **entries with no `paymentMode` count as cash** (legacy data).
- `employeeCollections(entries, from, to)` — credits grouped by `createdBy` (name, count, total, average), sorted by total.
- `routeAnalytics(routes, customers, entries, from, to)` — per route: customer count, all-time outstanding, billed/collected in period; trailing "—" bucket for route-less customers.
- `customerAnalytics(customers, entries)` — per customer all-time: outstanding, billed, collected, payment count, last payment date, days since, **average gap between payments** (span/(n-1) over distinct payment dates); sorted by outstanding desc.

### New: Analytics view (`src/screens/reports.tsx`, admin-only tab)

- ReportsScreen now has a top SegmentedControl: **Analytics | Export PDF** (old exports view unchanged underneath).
- Analytics: grain SegmentedControl (Daily/Weekly/Monthly/Yearly) → 4 KPI cards (billed/collected/collections/outstanding), **recharts** BarChart (billed vs collected per bucket, animated), payment-mode donut PieChart, employee collections + route performance as `MeterRow` lists (animated width bars), customer analysis top-15 with **slow payers (>30 days silent) flagged in debit red**.
- **recharts ^3.9.2 added to dependencies** (the one new library, per plan). Chart colors hardcoded to app tokens (`#e24b4a`, `#639922`, `#0f6e56`, `#5dcaa5`).
- "Download analytics PDF" button exports everything on screen for the selected grain.

### PDF system rewrite (`src/lib/pdf.ts`)

- Shared branded toolkit: dark-teal banner (app name + title + range + timestamp), rounded KPI boxes (`drawKpis`), left-accent section titles, `styledTable` (teal header, zebra rows, right-aligned numerals, dark footer row), page footers (`Page x/y`). Drawn shapes only — **no images**, files stay small. **jsPDF core fonts have no ₹ glyph → amounts print as "Rs 12,345"** (exported `money()` helper).
- `exportCustomerLedgerPdf` and `exportReportPdf` restyled (KPI band + totals footer; ledger table now shows Bill/Received/Mode columns).
- New `exportAnalyticsPdf(AnalyticsPdfData)`: KPI band + sections — period overview table (w/ totals), payment-mode share %, employee collections, route performance, customer analysis & payment frequency (all customers, slow payers in red). PDFs are English-only (established convention).

### Collection sheet: City → Route (`src/screens/collection.tsx`)

- Filter Picker now lists routes (staff see only their allocated routes via store scoping — verified); rows = customers with that `routeId`; sheet titled with route name. New i18n `pickRouteHint`/`noDuesInRoute`. Print flow (window.print) unchanged.

### Customers pagination (`src/screens/customers.tsx`)

- 10/page after all filters/sort; `x–y / total` pager with chevron buttons (hidden ≤1 page); page resets on any filter/search/sort change; `key={currentPage}` re-triggers the stagger animation per page.

### Verified in emulator

Staff: collection route picker offers only Bilara/Pipar, sheet renders titled by route. Admin: analytics renders all sections with correct numbers (outstanding ₹1,07,500 ✓ = seed minus test payment), grain switching works, pagination shows 1–10/12 then 11–12/12, analytics PDF generates without errors.

### Phase 4 rework after user feedback (2026-07-07) — verified by user

User wanted: more analytics, graphs inside the PDF, single-day/custom-range downloads, no forced full-customer lists, selectable PDF sections.

- **Analytics engine additions** (`analytics.ts`): `rangeBuckets(entries, from, to)` (1 day → 1 bucket, ≤92 days → daily, else monthly), `weekdayPattern` (Mon-first credit totals by weekday), `districtAnalytics`, `collectionsLog` (flat credit list w/ customer + collector, newest first), `overdueCustomers(stats, minDays=30)`.
- **Vector charts in PDFs** (`pdf.ts`): `pdfBarChart` (grouped billed/collected + gridlines + legend), `pdfDonut` (ring-segment polygons via `fillPolygon` using `doc.lines`), `pdfHBars` (label · track · value rows), `ensureSpace` page-break guard. Pure jsPDF shapes — real graphs, zero images. `exportAnalyticsPdf` now takes `sections: AnalyticsSection[]` (`overview|weekday|modes|employees|routes|districts|watchlist|customers|log`) + `allCustomers` flag (top-20 default); collections log capped at 400 rows with count note.
- **Analytics screen** (`reports.tsx`): period is now a Picker — **Today / Daily·30 / Weekly·12 / Monthly·12 / Yearly / Custom range** (custom shows From/To DatePickers; single-day = Today or same custom dates). KPIs: 4 cards (Billed, Collected, **Recovery rate %**, Outstanding) + mini-strip (Collections, Avg collection, Per day, Overdue count). New cards: weekday-pattern bar chart, District overview meters, **Overdue watchlist** (30+ days silent, red, top 10, "all caught up" empty state). Overview chart is now a ComposedChart with a dashed net line. Download card has a **MultiPicker** (new multi-select component in `picker.tsx` with select-all header + count badge) choosing PDF sections; customer analysis offered as "Top 20" or "All customers".
- `MultiPicker` is reusable: `values/options/onChange/allLabel/countLabel`.

### Notes

- Console may show transient `permission-denied` snapshot-listener noise at reload boundaries after long emulator sessions (auth-token refresh race) — harmless, data loads right after; also stale vite HMR errors persist in the tool's log buffer.

## Phase 5: Quick UI Corrections — ✅ DONE (2026-07-07)

1. **Bill/Cash wording** — i18n-only change: `debit: 'Debit'→'Bill'`, `credit: 'Credit'→'Cash'`, `monthDebit`/`monthCredit` lowercase equivalents (`src/lib/i18n.ts`, English only — Hindi already said "दिया"/"मिला", no literal banking jargon to replace). No literal "Debit"/"Credit" strings existed anywhere else (verified via grep) — every usage went through these two keys (reports.tsx totals cards, home.tsx month strip), so the rename alone fixed the whole app + all PDFs (PDF column headers already said "Bill"/"Received", never "Debit"/"Credit").
2. **Month/year quick-select** (`src/components/ui/date-picker.tsx`): clicking the calendar header toggles a `mode: 'days' | 'months'` state — month mode shows a year stepper + 3×4 month grid; picking a month returns to the day grid on that month. Chevrons repurpose for year stepping in month mode.
3. **Future-date blocking** — baked directly into `DatePicker` (not opt-in per screen, so every instance in the app is covered automatically): day buttons and month buttons after today are `disabled` + dimmed; the day-grid's "next month" chevron disables once the visible month is the current month or later; the month-grid's "next year" chevron disables at the current year. Verified: on 2026-07-07, days 1–7 of July enabled, 8–31 disabled; Jan–Jul enabled, Aug–Dec disabled; navigating to May (fully past) shows all 31 days enabled.
4. **Day Report single date** (`src/screens/reports.tsx` `ExportsView`): new `dayDate` state used only when `type === 'daySummary'`; `effectiveRange = {from: dayDate, to: dayDate}` feeds both the totals cards and PDF export; UI swaps the From/To pair for one `Field label={t('date')}` DatePicker when Day summary is selected, reverts for every other report type (verified both ways).

## Post-Phase-5: Collection screen extras (2026-07-07)

Two user-requested additions to `src/screens/collection.tsx`, both verified in the emulator:

1. **Bulk "Add customers to route"** — admin-only button next to the route/date pickers opens `AddCustomersToRouteSheet`: searchable checklist of every customer NOT already on the selected route (shows their current route as a hint if any), multi-select, then `assignCustomersToRoute(customerIds, routeId)` (new store method, `src/lib/store.tsx`) batch-writes `routeId` for all selected customers in one go (cloud: `writeBatch`; demo: array map). Lets an existing customer be moved onto a newly created route without opening each customer's edit sheet individually.
2. **Per-print customer exclusion** — a small "Edit selection" toggle in the collection-sheet header (visible to staff too, since it's just a local view convenience, not a data mutation) reveals a checkbox column; unchecking a customer dims their row and removes them from the printed sheet and the total **for that render only** — pure `React.useState` (`excludedIds: Set<string>`), never written to Firestore, resets automatically whenever the route or date changes. The checkbox column and toggle are `print:hidden`; excluded rows get `print:hidden` too, so the printed output reflects exactly the deselected set.

New i18n keys (en + hi): `addCustomersToRoute`, `addCustomersToRouteHint`, `currentlyOn`, `addSelected`, `noCustomersToAdd`, `editSelection`, `doneEditing`, `included`.

## Post-Phase-5: Route membership manager (2026-07-07)

User clarification: needed bulk assign/unassign/reassign of *existing* customers per route (a new route shouldn't require editing every customer individually).

- **New shared component** `src/components/app/route-members-sheet.tsx` (`RouteMembersSheet`): top half lists customers on the route with one-tap **Remove from route** (UserMinus); bottom half is a searchable multi-select of everyone else (**unassigned customers sorted first**, others show "currently on <route>") with an Add button. The sheet stays open after add/remove for continued management. It replaced the collection-only `AddCustomersToRouteSheet` (deleted).
- **Store**: `assignCustomersToRoute(customerIds, routeId)` now treats `routeId === ''` as *unassign* (`routeId || undefined`, full-replace write so the field actually disappears).
- **Entry points** (admin only): a Users icon per route row in Settings → Routes, and the Collection screen button (relabeled `manageRouteCustomers`). Per-customer assignment (single assign/unassign/switch) already existed via the customer edit sheet's Route picker.
- New i18n keys: `manageRouteCustomers`, `onThisRoute`, `removeFromRoute`, `noneOnRoute`. Verified in emulator: remove → member count drops and customer moves to candidates; add back → restored; same sheet works from both entry points; zero console errors. **Note: emulator data currently contains user-created test routes (e.g. BHADRAVATHI) — don't re-seed without asking.**
