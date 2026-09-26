import { QueryClient } from '@tanstack/react-query'

/**
 * networkMode 'always': Firestore owns offline (IndexedDB cache + write queue).
 * The default 'online' pauses every query/mutation while offline, so the field
 * phone hung on "Kaydediliyor…" and showed an empty history.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { networkMode: 'always' },
    },
  })
}
