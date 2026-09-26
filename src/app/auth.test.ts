import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Auth, User } from 'firebase/auth'
import { useStaffAuth } from './auth'

// The signed-in user onAuthStateChanged reports.
let current: Partial<User> | null = null
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  getRedirectResult: () => Promise.resolve(null),
  onAuthStateChanged: (_auth: unknown, next: (user: Partial<User> | null) => void) => {
    next(current)
    return () => {}
  },
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}))

const auth = {} as Auth
const stored = new Map<string, string>()
beforeEach(() => {
  current = { email: 'Memur@x.com', emailVerified: true, displayName: 'Memur' }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  })
})
afterEach(() => {
  stored.clear()
  vi.unstubAllGlobals()
})

const memur = async () => ({ roles: ['memur'] })
const offline = () => Promise.reject(new Error('Failed to get document because the client is offline.'))

describe('useStaffAuth çevrimdışı', () => {
  it('yetki okunamazsa son bilinen yetkiyle açılır', async () => {
    const online = renderHook(() => useStaffAuth(auth, memur))
    await waitFor(() => expect(online.result.current.state.status).toBe('ready'))
    online.unmount()

    const { result } = renderHook(() => useStaffAuth(auth, offline))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    const state = result.current.state
    expect(state.status === 'ready' && state.access.roles).toEqual(['memur', 'koc'])
  })

  it('daha önce hiç açılmamışsa hata gösterir', async () => {
    const { result } = renderHook(() => useStaffAuth(auth, offline))
    await waitFor(() => expect(result.current.state).toEqual({ status: 'error', message: expect.stringContaining('offline') }))
  })
})
