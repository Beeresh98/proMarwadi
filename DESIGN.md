# ProMarwadi Design System

Visual direction: "Clean fintech" shell (deep teal + warm neutrals) with plain-spoken
ledger language ("You gave / You got", "lena hai / dena hai") instead of accounting jargon.
Mobile-first; desktop gets a sidebar, mobile gets a bottom tab bar.

All tokens live in `src/index.css` under `@theme` (Tailwind v4).

## Color — three jobs only

| Role | Token | Value | Rule |
| --- | --- | --- | --- |
| Brand | `primary` / `primary-pressed` / `primary-tint` / `hero` | `#0F6E56` / `#085041` / `#E1F5EE` / `#04342C` | Navigation, primary buttons, selection, hero cards. Nothing else. |
| Debit (customer owes) | `debit` / `debit-strong` / `debit-tint` | `#A32D2D` / `#E24B4A` / `#FCEBEB` | Reserved for money owed to you. Never decorative. |
| Credit (money received) | `credit` / `credit-strong` / `credit-tint` | `#3B6D11` / `#639922` / `#EAF3DE` | Reserved for money received. Never decorative. |
| Neutrals | `background` `card` `fill` `muted` `border` `border-strong` `muted-foreground` `secondary-text` `foreground` | warm gray ramp (`#FBFAF8` → `#2C2C2A`) | Warm gray, never blue-gray. |

Balance sign convention: positive = red + "owes you / lena hai", negative = green +
"you owe / dena hai", zero = gray + "settled".

## Typography

- Families: Inter + Noto Sans Devanagari (loaded in `index.html`). Weights 400/500 only.
- Every rendered amount uses the `.tnum` class (tabular numerals) so digits align.
- Scale: money-hero 34px, screen title 17px, heading 20px, money-row 17/15px,
  body 15px, caption 13px. Floor: nothing below 11px, nothing user-critical below 13px.
- Devanagari gets extra line-height (1.7) via `:lang(hi)`.

## Language

`src/lib/i18n.ts` holds the bilingual glossary. UI speaks ledger, not accounting:
"You gave −" (दिया −), "You got +" (मिला +), "owes you" (लेना है), "Balance" (हिसाब).
"Debit/credit" survive only in reports and PDFs.

## Components

- `components/ui/button.tsx` — variants: `primary` (teal, one per screen max),
  `secondary`, `ghost`, `debit` (red outline), `credit` (green solid), `destructive`.
  Default height 48px (thumb-first).
- `components/ui/picker.tsx` — custom `Picker` dropdown (optionally searchable) and
  `SegmentedControl`. No native `<select>` anywhere.
- `components/ui/date-picker.tsx` — custom bilingual calendar popover. No native date input.
- `components/ui/sheet.tsx` — bottom sheet on mobile / centered modal on desktop,
  plus `ConfirmDialog` for destructive actions.
- `components/app/money.tsx` — `Balance` (colored amount + owes-you label) and `Avatar`.

## Motion

Defined in `src/index.css`; everything respects `prefers-reduced-motion`.

- `.pressable` — scale(0.97) press feedback on every interactive control.
- `.liftable` — hover lift for cards (pointer devices only).
- `.stagger` — staggered fade-up entrance for lists (caps at 9+ children).
- `animate-fade-up` / `animate-pop-in` / `animate-sheet-up` — screen, popover, and
  sheet entrances. Balance amounts re-animate on change via `key={amount}`.

## Layout

- Screens live in `src/screens/`; shell + navigation in `src/App.tsx`;
  state in `src/lib/store.tsx` (context over localStorage, Firebase-ready).
- Mobile: single column, bottom tab bar, sticky give/got action bar above it.
- Desktop (`lg:`): fixed 240px sidebar, content centered at max-w-2xl.
- Radii: 8px controls (`--radius-control`), 14px cards (`--radius-card`).
