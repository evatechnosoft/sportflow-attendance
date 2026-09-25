import type { ReactNode } from 'react'

const CLUB_NAME = 'İstanbul Anadolu Gençlik ve Spor Kulübü'

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-24 w-24" />
        <h2 className="mt-4 max-w-sm font-display text-2xl font-semibold tracking-tight">{CLUB_NAME}</h2>
      </div>
      {children}
    </div>
  )
}

export function LoginScreen({ onSignIn, error }: { onSignIn: () => void; error?: string }) {
  return (
    <AuthCard>
      <p className="max-w-sm text-sm text-ink-2">Devam etmek için kulüpte kayıtlı Google hesabınla giriş yap.</p>
      <button
        type="button"
        onClick={onSignIn}
        className="min-h-11 rounded-[20px] bg-brand px-6 py-3 font-display font-semibold text-bg transition hover:opacity-90"
      >
        Google ile giriş yap
      </button>
      {error && <p className="max-w-sm text-sm text-absent">{error}</p>}
    </AuthCard>
  )
}

/** Signed in, but no club role (or the role could not be read). */
export function AccessDenied({ message, email, onSignOut }: { message: string; email?: string; onSignOut: () => void }) {
  return (
    <AuthCard>
      <div>
        <p className="max-w-sm text-sm font-semibold">{message}</p>
        {email && <p className="mt-1 text-xs text-ink-3">{email}</p>}
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="min-h-11 rounded-[20px] border border-line px-6 py-3 font-display font-semibold transition hover:bg-surface"
      >
        Çıkış yap
      </button>
    </AuthCard>
  )
}
