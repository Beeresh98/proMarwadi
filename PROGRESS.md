# ProMarwadi Development Progress

**Last Updated:** 3 July 2026

## Completed ✅

### Design System (Phase 1)
- [x] Color palette finalized: teal brand (#0F6E56), warm grays, red/green semantics
- [x] Typography system: Inter + Noto Sans Devanagari, tabular numerals
- [x] Token system in Tailwind v4 (@theme in index.css)
- [x] DESIGN.md documented

### Architecture (Phase 2)
- [x] Refactored from single monolithic App.tsx → modular screens + store
- [x] React Context store (src/lib/store.tsx) — localStorage-backed, Firebase-ready
- [x] Five screens: Home, Customers, Ledger, Reports, Settings
- [x] Mobile-first layout: bottom tab bar + sticky action buttons
- [x] Desktop layout: fixed sidebar navigation (240px)

### Components (Phase 3)
- [x] Custom UI primitives: Button, Card, Form, Sheet, ConfirmDialog
- [x] Custom Picker (dropdown with optional search) — no native `<select>`
- [x] Custom DatePicker (bilingual calendar) — no native date input
- [x] Money components: Balance (colored amount + label), Avatar
- [x] All components support motion + prefers-reduced-motion

### Features
- [x] District dashboard with receivable totals
- [x] Customer CRUD with duplicate detection
- [x] Ledger view with running balance + edit flags
- [x] Universal entry flow (You gave − / You got +)
- [x] Custom date range picker for ledgers + reports
- [x] Eight report types (customer, all clients, day/month/city/district summaries)
- [x] PDF export (jsPDF + autoTable)
- [x] JSON/CSV backup export
- [x] Bilingual (English/Hindi) with Hinglish money language
- [x] Admin/staff role toggle with permission checks
- [x] Payment mode on credit entries (Cash/Bank/UPI with bank name + UPI app), badges in ledger
- [x] City-wise collection sheet (print-optimized, blank amount-received boxes)
- [x] City combobox with "+ Add new city" in customer form (typo-proof)

### Code Quality
- [x] TypeScript strict mode
- [x] Build passes (tsc + vite build)
- [x] Linting passes (oxlint, minor fast-refresh warnings)
- [x] No native browser pickers (custom implementations)
- [x] Subtle animations on all interactions (press, lift, stagger, sheet)

### Testing
- [x] Dev server running on port 5173
- [x] Home screen verified (hero card, districts, customers)
- [x] Ledger drilldown verified (balance, date picker, entries)
- [x] Entry sheet verified (searchable picker, calendar, save)
- [x] Customers screen verified (search, district filter)
- [x] Reports screen verified (dropdowns, date range)
- [x] Hindi language switch working
- [x] Desktop responsive layout verified (sidebar shows, bottom nav hides)

## Known Limitations

- **PDF Devanagari rendering:** jsPDF doesn't support Noto Sans Devanagari out of the box. Report labels work in English, but Hindi text in PDFs shows as garbled. Workaround: embed Noto font in jsPDF (post-MVP).
- **Timezone handling:** Fixed date calculation bug (was using ISO string with IST offset). Now using local date formatting.
- **Firebase integration:** Authentication and Firestore persistence are configured but not yet wired in. App runs in localStorage demo mode.

## Next Steps (Future Phases)

1. **Firebase Authentication** — Wire up email/password login, replace demo role toggle
2. **Firestore Persistence** — Connect customer/entry/user collections
3. **Devanagari in PDFs** — Embed Noto font in jsPDF for Hindi report export
4. **Offline Mode** — Service worker + local queue for offline-first UX
5. **Advanced Features** — WhatsApp sharing, fuzzy duplicate detection, audit logs, staff management UI

## Screenshots

See `/review/` folder for latest UI screenshots (home, ledger, customers, reports, mobile).
