import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

export interface FirebaseEnv {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

/** Env eksikse Firestore'a hiç bağlanma — uygulama mock ile açılsın. */
export function readFirebaseEnv(env: ImportMetaEnv): FirebaseEnv | null {
  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  if (!apiKey || !authDomain || !projectId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
}

let cached: { app: FirebaseApp; db: Firestore; auth: Auth } | null = null

/**
 * Offline: persistentLocalCache IndexedDB'ye yazar, çoklu sekme yöneticisiyle.
 * Ağ yokken okumalar cache'ten gelir, yazmalar kuyruğa alınır.
 */
export function initFirebase(config: FirebaseEnv) {
  if (cached) return cached
  const app = initializeApp(config)
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  cached = { app, db, auth: getAuth(app) }
  return cached
}
