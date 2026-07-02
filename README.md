# ProMarwadi

Simple bilingual ledger app for a chappal shop.

## Current State

- React + Vite + TypeScript app.
- ShadCN/Radix-style UI primitives.
- English/Hindi language switch.
- Admin/staff role-aware screens.
- District card dashboard.
- Customer CRUD with duplicate warnings.
- Universal debit/credit entry.
- Customer ledger with edit flags.
- PDF exports and JSON/CSV backup exports.
- Firebase-ready config and security rule draft.

The app currently runs in local demo mode using `localStorage`. Add Firebase credentials in `.env.local` when ready to connect real Authentication and Firestore persistence.

## Run Locally

```bash
npm install
npm run dev
```

## Firebase Environment

Copy `.env.example` to `.env.local` and fill values from Firebase project settings:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```
