import { useState } from 'react'
import { AttendanceScreen } from './features/attendance/AttendanceScreen'
import { ManageScreen } from './features/manage/ManageScreen'

const TABS = [
  { id: 'attendance', label: 'Yoklama' },
  { id: 'manage', label: 'Tanımlar' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('attendance')

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-lg font-semibold tracking-tight">SportFlow</h1>
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
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        {tab === 'attendance' ? <AttendanceScreen /> : <ManageScreen />}
      </main>
    </div>
  )
}
