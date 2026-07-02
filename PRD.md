# ProMarwadi Ledger App PRD

## 1. Product Overview

ProMarwadi is a simple, clean, bilingual ledger web app for a chappal shop. The app helps the owner and staff maintain customer debit/credit ledgers, distinguish customers by district/city, and export ledger reports as PDFs in multiple useful formats.

The app must work from anywhere on mobile and desktop. Firebase will be used for authentication, cloud data storage, and hosting.

## 2. Goals

- Maintain accurate customer ledgers with debit and credit entries.
- Support customer CRUD with duplicate detection before saving.
- Provide city/district-wise customer organization.
- Give staff a fast universal debit/credit entry flow from the main page.
- Restrict sensitive edits and deletes to admin users.
- Mark entries that have been edited after creation.
- Export PDF reports in every practical format requested by the shop.
- Support English and Hindi through a language switch.
- Keep the interface simple enough for users moving from a physical ledger book.

## 3. Non-Goals

- Inventory management.
- Product-level chappal model, quantity, and rate tracking.
- GST billing or invoice generation.
- Company branding on PDF reports.
- Online payment collection.
- SMS/WhatsApp automation in the first version.

## 4. User Roles

### Admin / Owner

- Can create, read, update, and delete customers.
- Can add debit/credit ledger entries.
- Can edit or delete existing ledger entries.
- Can see edit flags on modified entries.
- Can export all report types.
- Can manage staff access in a future version.

### Staff

- Can view customers and ledgers.
- Can add debit/credit entries.
- Cannot edit or delete existing ledger entries.
- Cannot delete customers.
- Can export reports if admin allows in settings. Default: allowed.

## 5. Core Entities

### Customer

- `id`
- `name`
- `phone`
- `district`
- `city`
- `address` optional
- `openingBalance`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`

### Ledger Entry

- `id`
- `customerId`
- `date`
- `type`: `debit` or `credit`
- `amount`
- `note` optional
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`
- `isEdited`
- `editCount`

### User Profile

- `id`
- `email`
- `displayName`
- `role`: `admin` or `staff`
- `createdAt`

## 6. Ledger Rules

- Debit means the customer owes more money.
- Credit means the customer paid money and owes less.
- Current balance formula:

```text
opening balance + total debit - total credit
```

- Ledgers should show date-wise entries with a running balance.
- Default ledger view for a selected customer should show the current month.
- Manual date pickers must allow custom date ranges for ledgers and reports.

## 7. Customer Management

### Required Features

- Add customer.
- Edit customer.
- Delete customer, admin only.
- View customer details.
- Search by customer name, phone, district, or city.
- Filter by district and city.
- Duplicate check before creating or updating.

### Duplicate Detection

The app should warn when a new or edited customer matches existing records by:

- Same phone number.
- Same normalized name and same city.
- Similar normalized name and same district, if possible in a later version.

The user should be informed with the possible duplicate customer name, phone, and city before continuing.

## 8. Main Page / Landing Experience

The first authenticated screen should focus on districts.

### District Cards

- Show one card per district.
- Each card shows:
  - District name.
  - Number of customers.
  - Total receivable balance.
  - Debit and credit summary for selected date range, default current month.

### District Drilldown

Pressing a district card reveals district data:

- Customers in that district.
- Customer balances.
- Search/filter within that district.
- City grouping inside the district where useful.

### Customer Ledger Drilldown

Selecting a customer opens that customer ledger:

- Default range: current month.
- Customer details at top.
- Debit/credit rows.
- Running balance.
- Date range picker.
- PDF export.

### Universal Entry

The main page must include a universal debit/credit entry section:

- Select customer.
- Select date.
- Select debit or credit.
- Enter amount.
- Optional note.
- Submit.

This flow should be fast and always visible or one tap away.

## 9. Reports And PDF Export

All reports must support manual date pickers.

### Required PDF Reports

- Customer-wise ledger.
- All clients ledger.
- Day summary.
- Month summary.
- City summary.
- City day summary.
- District summary.
- District day summary.

### PDF Format

- Plain format.
- Include customer details where relevant.
- Include report title.
- Include selected date range.
- Include generated date.
- No company details or logo for now.

## 10. Language Support

The app must support:

- English.
- Hindi.

The language switch should change UI labels, actions, empty states, table headings, and report labels. Stored customer data should remain as entered by the user.

## 11. Firebase Architecture

### Firebase Services

- Firebase Authentication for email/password login.
- Cloud Firestore for customer, user, and ledger data.
- Firebase Hosting for deployment.

### Firestore Collections

```text
users/{userId}
customers/{customerId}
ledgerEntries/{entryId}
```

### Security Expectations

- Only authenticated users can access shop data.
- Staff can create entries but cannot edit or delete existing entries.
- Admin can manage all records.
- Role must be checked in Firestore security rules and in the UI.

## 12. Backup And Restore

### Required

- Export all customers and ledger entries as JSON.
- Export customers as CSV.
- Export ledger entries as CSV.

### Future

- Import from JSON backup.
- Import initial customer list from CSV or Excel.

## 13. UI Requirements

- Use ShadCN UI components.
- Clean and simple interface.
- Mobile-first, but comfortable on desktop.
- No decorative landing page; the first screen should be the working district dashboard.
- Tables and forms must be readable on mobile.
- Use clear empty states.
- Use confirmations for destructive admin actions.

## 14. MVP Scope

### MVP Must Include

- Login screen.
- Admin/staff role-aware layout.
- District card dashboard.
- Customer CRUD with duplicate warnings.
- Universal debit/credit entry.
- Customer monthly ledger view.
- Manual date range pickers.
- English/Hindi language switch.
- PDF exports for customer ledger, all clients, day summary, month summary, city summary, and city day summary.
- JSON/CSV export backup.

### Post-MVP

- Staff management UI.
- Import from CSV/Excel.
- WhatsApp sharing.
- Audit log screen.
- Advanced fuzzy duplicate detection.
- Offline-first queueing.

## 15. Success Criteria

- Owner can add customers from old ledger book.
- Staff can add daily debit/credit entries without touching old entries.
- Admin can correct mistakes and edited entries are clearly flagged.
- Customer ledger PDFs can be generated for any selected date range.
- City/district reports help the owner understand outstanding dues by area.
- App remains simple enough for daily shop use.
