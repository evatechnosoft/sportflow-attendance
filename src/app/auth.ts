import { useCallback, useEffect, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { resolveAccess, type StaffAccess } from './staffAccess'

// Kept identical in clubcrm and sportflow (src/app/auth.ts).

export type StaffAuthState =
  /** Auth not configured: local mode, no sign-in. */
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'signedOut'; error: string }
  | { status: 'noAccess'; email: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; email: string; displayName: string; access: StaffAccess }

export function staffReader(db: Firestore) {
  return async (emailLower: string): Promise<unknown> => {
    const snapshot = await getDoc(doc(db, 'staff', emailLower))
    return snapshot.exists() ? snapshot.data() : null
  }
}

const message = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback)

// Last resolved access per e-mail: offline the staff doc may be missing from the
// Firestore cache, and the field phone must still open. The role only shapes the
// view; the rules decide every write.
const accessKey = (email: string) => `anadoluspor.access.${email.toLowerCase()}`

function rememberAccess(email: string, access: StaffAccess | null): void {
  try {
    if (access) localStorage.setItem(accessKey(email), JSON.stringify(access))
    else localStorage.removeItem(accessKey(email))
  } catch {
    // Storage blocked (private window): no offline fallback.
  }
}

function rememberedAccess(email: string): StaffAccess | null {
  try {
    const raw = localStorage.getItem(accessKey(email))
    return raw ? (JSON.parse(raw) as StaffAccess) : null
  } catch {
    return null
  }
}

/** Popup first; on phones that block popups, fall back to a full-page redirect. */
async function signInWithGoogle(auth: Auth): Promise<void> {
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (cause) {
    if (!(cause instanceof FirebaseError)) throw cause
    if (cause.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider)
    if (cause.code === 'auth/popup-closed-by-user' || cause.code === 'auth/cancelled-popup-request') return
    throw cause
  }
}

/**
 * Google sign-in + role from staff/{emailLower}. Only verified e-mails get a
 * role; the rules enforce the same, the role here only shapes the view.
 */
export function useStaffAuth(auth: Auth | null, readStaff: ((emailLower: string) => Promise<unknown>) | null) {
  const [state, setState] = useState<StaffAuthState>(auth ? { status: 'loading' } : { status: 'off' })

  useEffect(() => {
    if (!auth || !readStaff) return
    let latest = 0
    getRedirectResult(auth).catch((cause: unknown) =>
      setState({ status: 'signedOut', error: message(cause, 'Giriş başarısız') }),
    )
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const run = ++latest
      if (!user) return setState({ status: 'signedOut', error: '' })
      if (!user.email || !user.emailVerified) return setState({ status: 'noAccess', email: user.email ?? '' })
      const email = user.email
      setState({ status: 'loading' })
      resolveAccess(email, readStaff).then(
        (access) => {
          if (run !== latest) return
          rememberAccess(email, access)
          setState(
            access
              ? { status: 'ready', email: email.toLowerCase(), displayName: access.displayName ?? user.displayName ?? email, access }
              : { status: 'noAccess', email },
          )
        },
        (cause: unknown) => {
          if (run !== latest) return
          const known = rememberedAccess(email)
          setState(
            known
              ? { status: 'ready', email: email.toLowerCase(), displayName: known.displayName ?? user.displayName ?? email, access: known }
              : { status: 'error', message: message(cause, 'Yetki okunamadı') },
          )
        },
      )
    })
    return () => {
      latest = -1
      unsubscribe()
    }
  }, [auth, readStaff])

  const signIn = useCallback(async () => {
    if (!auth) return
    try {
      await signInWithGoogle(auth)
    } catch (cause) {
      setState({ status: 'signedOut', error: message(cause, 'Giriş başarısız') })
    }
  }, [auth])

  const signOutUser = useCallback(async () => {
    if (auth) await signOut(auth)
  }, [auth])

  return { state, signIn, signOutUser }
}
