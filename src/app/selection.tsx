import { createContext, useContext, useState, type ReactNode } from 'react'
import { todayIso } from '../features/attendance/date'

interface Selection {
  groupId: string
  date: string
  setGroupId: (id: string) => void
  setDate: (iso: string) => void
}

const SelectionContext = createContext<Selection | null>(null)

/** Grup + tarih seçimi Yoklama ve Geçmiş sekmeleri arasında ortak. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [groupId, setGroupId] = useState('')
  const [date, setDateState] = useState(() => todayIso())
  // Yoklama ileri tarihe alınmaz: bugünden sonrası bugüne çekilir.
  const setDate = (iso: string) => setDateState(iso > todayIso() ? todayIso() : iso)
  return (
    <SelectionContext.Provider value={{ groupId, date, setGroupId, setDate }}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection(): Selection {
  const value = useContext(SelectionContext)
  if (!value) throw new Error('SelectionProvider eksik')
  return value
}
