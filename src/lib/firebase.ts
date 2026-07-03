import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/* Web app config identifies the project; it ships in the bundle and is not a
   secret — data protection comes from Firestore security rules. Env vars can
   override (e.g. to point a fork at another project). */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDh7YtvK1CgsgYvRkB9MFRAaNg3IVJlxWg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'promarwadi-63230.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'promarwadi-63230',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'promarwadi-63230.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '669783766857',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:669783766857:web:8ecf2141f970bcb7f8cc98',
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp ? getFirestore(firebaseApp) : null
