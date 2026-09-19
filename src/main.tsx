import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { DataSourceProvider } from './app/dataSource'
import { createMockDataSource } from './adapters/mock/mockDataSource'
import { buildSeed } from './adapters/mock/seed'

// v1: tek adapter. API adapter'ı geldiğinde değişen tek satır burası.
const dataSource = createMockDataSource(buildSeed())
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider value={dataSource}>
        <App />
      </DataSourceProvider>
    </QueryClientProvider>
  </StrictMode>,
)
