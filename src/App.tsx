import { useState } from 'react'
import { AttendanceScreen } from './features/attendance/AttendanceScreen'
import { ManageScreen } from './features/manage/ManageScreen'
import { LoginScreen } from './features/auth/LoginScreen'
import { useFirebaseAuth } from './app/auth'
import type { DataSourceHandle } from './app/createDataSource'
import { initFirebase, readFirebaseEnv } from './adapters/firestore/firebase'

const TABS = [
  { id: 'attendance', label: 'Yoklama' },
  { id: 'manage', label: 'Tanımlar' },
] as const

type TabId = (typeof TABS)[number]['id']

const firebaseConfig = readFirebaseEnv(import.meta.env)
const auth = firebaseConfig ? initFirebase(firebaseConfig).auth : null

export default function App({ handle }: { handle: DataSourceHandle }) {
  const [tab, setTab] = useState<TabId>('attendance')
  const { user, loading, error, signIn, signOutUser } = useFirebaseAuth(
    handle.requiresAuth ? auth : null,
  )

  const needsLogin = handle.requiresAuth && !user

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-lg font-semibold tracking-tight">SportFlow</h1>
            <SourceBadge handle={handle} />
          </div>

          {!needsLogin && (
            <nav className="flex gap-1 rounded-full bg-surface p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    tab === item.id ? 'bg-brand text-white shadow-sm' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {user && (
            <button
              type="button"
              onClick={signOutUser}
              className="text-xs text-ink/50 underline-offset-2 hover:underline"
            >
              Çıkış
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        {loading ? (
          <p className="py-10 text-center text-sm text-ink/50">Oturum kontrol ediliyor…</p>
        ) : needsLogin ? (
          <LoginScreen
            onSignIn={signIn}
            error={error}
            projectId={import.meta.env.VITE_FIREBASE_PROJECT_ID}
          />
        ) : tab === 'attendance' ? (
          <AttendanceScreen />
        ) : (
          <ManageScreen />
        )}
      </main>
    </div>
  )
}

function SourceBadge({ handle }: { handle: DataSourceHandle }) {
  if (handle.kind === 'mock') {
    return (
      <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink/50">
        demo veri
      </span>
    )
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        handle.writable ? 'bg-brand/10 text-brand' : 'bg-warn/15 text-warn'
      }`}
    >
      {handle.writable ? 'canlı' : 'canlı · salt okunur'}
    </span>
  )
}
