import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AttendanceScreen } from './features/attendance/AttendanceScreen'
import { HistoryScreen } from './features/attendance/HistoryScreen'
import { ManageScreen } from './features/manage/ManageScreen'
import { StudentsScreen } from './features/students/StudentsScreen'
import { AccessDenied, LoginScreen } from './features/auth/LoginScreen'
import { staffReader, useStaffAuth, useViewRole } from './app/auth'
import { STAFF_ROLE_LABEL, type StaffRole } from './app/staffAccess'
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
const firebase = firebaseConfig ? initFirebase(firebaseConfig) : null
const readStaff = firebase ? staffReader(firebase.db) : null
/** Google sign-in with local data (until B3); a Firestore data source always needs it. */
const AUTH_ON = import.meta.env.VITE_AUTH === 'google'
const NO_ROLES: StaffRole[] = []

export default function App({ handle }: { handle: DataSourceHandle }) {
  const [tab, setTab] = useState<TabId>('attendance')
  const db = useDataSource()
  const { mode, cycle } = useTheme()
  const club = useQuery({ queryKey: ['club-identity'], queryFn: () => db.settings.clubIdentity() })
  const { state, signIn, signOutUser } = useStaffAuth(
    handle.requiresAuth || AUTH_ON ? (firebase?.auth ?? null) : null,
    readStaff,
  )
  const [viewRole, setViewRole] = useViewRole(state.status === 'ready' ? state.access.roles : NO_ROLES)

  const needsLogin = state.status !== 'off' && state.status !== 'ready'
  // Coaches only take attendance; the CRM link is for admin/memur views.
  const showManage = state.status === 'off' || (state.status === 'ready' && viewRole !== 'koc')
  // Group/settings definitions are memur+; a coach view falls back to attendance.
  const tabs = viewRole === 'koc' ? TABS.filter((item) => item.id !== 'manage') : TABS
  const currentTab: TabId = tabs.some((item) => item.id === tab) ? tab : 'attendance'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b-[3px] border-accent bg-header px-4 py-3 text-on-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-11 w-11 shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide">
                {club.data?.primaryName ?? 'Anadolu Spor'}
              </h1>
              <div className="flex min-w-0 items-center gap-2">
                {club.data?.secondaryName && (
                  <span className="truncate text-xs text-on-header-2">{club.data.secondaryName}</span>
                )}
                <SourceBadge handle={handle} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {showManage && (
              <a
                href="/yonetim/"
                className="flex min-h-11 items-center px-2 text-xs font-semibold text-on-header-2 underline-offset-2 transition hover:text-on-header hover:underline"
              >
                Yönetim
              </a>
            )}
            <button
              type="button"
              onClick={cycle}
              aria-label={`Tema: ${THEME_LABEL[mode]}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-on-header-2 transition hover:text-on-header"
            >
              <ThemeIcon mode={mode} />
            </button>
          </div>
        </div>
        {state.status === 'ready' && viewRole && (
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-on-header-2">
            <span className="min-w-0 flex-1 truncate">{state.displayName}</span>
            {state.access.roles.length > 1 && (
              <select
                aria-label="Görünüm"
                value={viewRole}
                onChange={(event) => setViewRole(event.target.value)}
                className="min-h-9 rounded-lg border border-on-header-2 bg-header px-2 text-xs font-semibold text-on-header"
              >
                {state.access.roles.map((role) => (
                  <option key={role} value={role}>
                    {STAFF_ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="min-h-9 px-2 underline-offset-2 hover:text-on-header hover:underline"
            >
              Çıkış
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        {state.status === 'loading' ? (
          <p className="py-10 text-center text-sm text-ink-2">Oturum kontrol ediliyor…</p>
        ) : state.status === 'signedOut' ? (
          <LoginScreen onSignIn={() => void signIn()} error={state.error} />
        ) : state.status === 'noAccess' ? (
          <AccessDenied message="Bu hesabın kulüpte yetkisi yok." email={state.email} onSignOut={() => void signOutUser()} />
        ) : state.status === 'error' ? (
          <AccessDenied message={`Yetki okunamadı: ${state.message}`} onSignOut={() => void signOutUser()} />
        ) : currentTab === 'attendance' ? (
          <AttendanceScreen />
        ) : currentTab === 'history' ? (
          <HistoryScreen onPick={() => setTab('attendance')} />
        ) : currentTab === 'students' ? (
          <StudentsScreen readOnly={viewRole === 'koc'} />
        ) : (
          <ManageScreen />
        )}
      </main>

      {!needsLogin && (
        <nav className="fixed inset-x-0 bottom-0 z-30">
          <div className="mx-auto flex max-w-3xl border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            {tabs.map((item) => {
              const active = currentTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 transition ${
                    active ? 'text-brand' : 'text-ink-2'
                  }`}
                >
                  {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-accent" />}
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                      active ? 'bg-brand/12' : ''
                    }`}
                  >
                    <TabIcon id={item.id} />
                  </span>
                  <span className={`text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
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
      <span className="shrink-0 rounded-full border border-on-header-2 px-2 py-0.5 text-[11px] font-medium text-on-header">
        demo veri
      </span>
    )
  }
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        handle.writable ? 'bg-present-soft text-present' : 'bg-late-soft text-late'
      }`}
    >
      {handle.writable ? 'canlı' : 'canlı · salt okunur'}
    </span>
  )
}
