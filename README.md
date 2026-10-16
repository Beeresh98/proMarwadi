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

## Remote on/off switch

In the Firebase console → Firestore, create the document `meta/appStatus` with a boolean field `live`.
Set `live` to `false` and the next time anyone opens the app they see a 15-second spinner and then a
"No connection" screen (Retry never gets through). Set it back to `true` (or delete the document) to
switch the app on again. If the status can't be read (offline/timeout) the app loads normally.
Deploy the rule first: `firebase deploy --only firestore:rules`.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```
