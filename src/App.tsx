import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AttendanceScreen } from './features/attendance/AttendanceScreen'
import { HistoryScreen } from './features/attendance/HistoryScreen'
import { ManageScreen } from './features/manage/ManageScreen'
import { StudentsScreen } from './features/students/StudentsScreen'
import { LoginScreen } from './features/auth/LoginScreen'
import { useFirebaseAuth } from './app/auth'
import type { DataSourceHandle } from './app/createDataSource'
import { initFirebase, readFirebaseEnv } from './adapters/firestore/firebase'
import { useDataSource } from './app/dataSource'
import { THEME_LABEL, useTheme, type ThemeMode } from './app/theme'

const TABS = [
  { id: 'attendance', label: 'Yoklama' },
  { id: 'history', label: 'Geçmiş' },
  { id: 'students', label: 'Sporcular' },
  { id: 'manage', label: 'Tanımlar' },
] as const

type TabId = (typeof TABS)[number]['id']

const firebaseConfig = readFirebaseEnv(import.meta.env)
const auth = firebaseConfig ? initFirebase(firebaseConfig).auth : null

export default function App({ handle }: { handle: DataSourceHandle }) {
  const [tab, setTab] = useState<TabId>('attendance')
  const db = useDataSource()
  const { mode, cycle } = useTheme()
  const club = useQuery({ queryKey: ['club-identity'], queryFn: () => db.settings.clubIdentity() })
  const { user, loading, error, signIn, signOutUser } = useFirebaseAuth(
    handle.requiresAuth ? auth : null,
  )

  const needsLogin = handle.requiresAuth && !user

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate font-display text-base font-semibold tracking-tight">
              {club.data?.primaryName ?? 'SportFlow'}
              {club.data?.secondaryName && (
                <span className="ml-1 font-normal text-ink-2">{club.data.secondaryName}</span>
              )}
            </h1>
            <SourceBadge handle={handle} />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={cycle}
              aria-label={`Tema: ${THEME_LABEL[mode]}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition hover:text-ink"
            >
              <ThemeIcon mode={mode} />
            </button>
            {user && (
              <button
                type="button"
                onClick={signOutUser}
                className="px-2 text-xs text-ink-2 underline-offset-2 hover:underline"
              >
                Çıkış
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        {loading ? (
          <p className="py-10 text-center text-sm text-ink-2">Oturum kontrol ediliyor…</p>
        ) : needsLogin ? (
          <LoginScreen
            onSignIn={signIn}
            error={error}
            club={club.data}
            projectId={import.meta.env.VITE_FIREBASE_PROJECT_ID}
          />
        ) : tab === 'attendance' ? (
          <AttendanceScreen />
        ) : tab === 'history' ? (
          <HistoryScreen onPick={() => setTab('attendance')} />
        ) : tab === 'students' ? (
          <StudentsScreen />
        ) : (
          <ManageScreen />
        )}
      </main>

      {!needsLogin && (
        <nav className="fixed inset-x-0 bottom-0 z-30">
          <div className="mx-auto flex max-w-3xl border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            {TABS.map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 transition ${
                    active ? 'text-brand' : 'text-ink-3'
                  }`}
                >
                  {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand" />}
                  <TabIcon id={item.id} />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function TabIcon({ id }: { id: TabId }) {
  if (id === 'attendance') {
    return (
      <svg {...iconProps}>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    )
  }
  if (id === 'students') {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    )
  }
  if (id === 'history') {
    return (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    )
  }
  return (
    <svg {...iconProps}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  )
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    )
  }
  if (mode === 'dark') {
    return (
      <svg {...iconProps}>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      </svg>
    )
  }
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  )
}

function SourceBadge({ handle }: { handle: DataSourceHandle }) {
  if (handle.kind === 'mock') {
    return (
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
        demo veri
      </span>
    )
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        handle.writable ? 'bg-present-soft text-present' : 'bg-late-soft text-late'
      }`}
    >
      {handle.writable ? 'canlı' : 'canlı · salt okunur'}
    </span>
  )
}
