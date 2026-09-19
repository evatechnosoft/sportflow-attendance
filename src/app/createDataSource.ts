import { createMockDataSource } from '../adapters/mock/mockDataSource'
import { buildSeed } from '../adapters/mock/seed'
import { initFirebase, readFirebaseEnv } from '../adapters/firestore/firebase'
import { createFirestoreDataSource } from '../adapters/firestore/firestoreDataSource'
import type { DataSource } from '../ports/repositories'

export interface DataSourceHandle {
  dataSource: DataSource
  kind: 'mock' | 'firestore'
  /** Firestore modunda yazma açık mı (canlı veriye dokunuyor mu). */
  writable: boolean
  requiresAuth: boolean
}

/**
 * Tek seçim noktası. Env eksikse veya mock istenmişse uygulama
 * ağ olmadan çalışmayı sürdürür — Pages dağıtımının davranışı budur.
 */
export function createDataSource(env: ImportMetaEnv): DataSourceHandle {
  const config = env.VITE_DATA_SOURCE === 'firestore' ? readFirebaseEnv(env) : null
  if (!config) {
    return {
      dataSource: createMockDataSource(buildSeed()),
      kind: 'mock',
      writable: true,
      requiresAuth: false,
    }
  }

  const allowWrites = env.VITE_FIRESTORE_WRITES === 'on'
  const { db } = initFirebase(config)
  return {
    dataSource: createFirestoreDataSource(db, { allowWrites }),
    kind: 'firestore',
    writable: allowWrites,
    requiresAuth: true,
  }
}
