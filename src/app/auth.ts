import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string
}

/** Firestore kuralları imzalı kullanıcı istiyor; giriş olmadan hiçbir koleksiyon okunmaz. */
export function useFirebaseAuth(auth: Auth | null): AuthState & {
  signIn: () => Promise<void>
  signOutUser: () => Promise<void>
} {
  const [state, setState] = useState<AuthState>({ user: null, loading: Boolean(auth), error: '' })

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (user) => setState({ user, loading: false, error: '' }))
  }, [auth])

  return {
    ...state,
    signIn: async () => {
      if (!auth) return
      try {
        await signInWithPopup(auth, new GoogleAuthProvider())
      } catch (cause) {
        setState((prev) => ({
          ...prev,
          error: cause instanceof Error ? cause.message : 'Giriş başarısız',
        }))
      }
    },
    signOutUser: async () => {
      if (auth) await signOut(auth)
    },
  }
}
