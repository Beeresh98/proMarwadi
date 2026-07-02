# ProMarwadi Review Screenshots

Screenshots of the completed design system and feature implementation.

## Desktop Layout (1280x800)

1. **home-desktop.png** — Home screen with sidebar navigation
   - Left sidebar with 4 nav items (Home, Customers, Reports, Settings)
   - Hero card: Total to receive ₹28,500 with debit/credit breakdown
   - District cards: Jodhpur, Pali, Shimoga with receivable amounts
   - Customer list with balances and "owes you" labels in red
   - Sticky "You gave −" / "You got +" action buttons

2. **ledger-desktop.png** — Customer ledger detail view
   - Back button + customer name with phone and location
   - Hero balance card with "owes you" status
   - From/To date pickers (custom calendar)
   - Opening balance and entry count
   - Ledger rows with debit/credit amounts, running balance, and "Edited ×1" flag
   - Edit/delete buttons on hover

3. **customers-desktop.png** — Customers screen with search and filter
   - Search box with custom picker for "All districts" filter
   - Customer list showing: avatar, name, location, phone, balance
   - All balances in red text with "owes you" label
   - "Add customer" button

4. **reports-desktop.png** — Reports screen with custom dropdowns
   - Report type picker (showing "City summary" selected)
   - City picker (searchable dropdown, showing Bilara, Pipar, Sojat options)
   - From/To date fields
   - Debit/Credit summary boxes (red tint for debit, green for credit)
   - Export PDF button

## Mobile Layout (375x812)

5. **home-mobile.png** — Home screen on phone
   - Top header with "ProMarwadi" and "Home" label
   - Hero card spans full width
   - District cards stacked (Jodhpur, Pali, Shimoga)
   - Customer list
   - Sticky "You gave −" / "You got +" buttons above bottom nav
   - Bottom tab bar: Home, Customers, Reports, Settings (Home active)

---

All screenshots demonstrate:
- ✅ Custom pickers (no native `<select>`)
- ✅ Custom calendar (no native date input)
- ✅ Teal brand color with red/green money semantics
- ✅ Warm neutral backgrounds
- ✅ Tabular-aligned numbers
- ✅ Responsive layout (sidebar on desktop, bottom nav on mobile)
- ✅ Bilingual support (all text English-ready, Hindi ready via language toggle)
