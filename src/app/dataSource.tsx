import { createContext, useContext, type ReactNode } from 'react'
import type { DataSource } from '../ports/repositories'

const DataSourceContext = createContext<DataSource | null>(null)

/** Tek DI noktası: uygulamanın tamamı somut adapter'ı değil, bu context'i görür. */
export function DataSourceProvider({
  value,
  children,
}: {
  value: DataSource
  children: ReactNode
}) {
  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>
}

export function useDataSource(): DataSource {
  const dataSource = useContext(DataSourceContext)
  if (!dataSource) throw new Error('DataSourceProvider eksik')
  return dataSource
}
