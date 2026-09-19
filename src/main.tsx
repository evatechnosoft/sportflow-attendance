import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { DataSourceProvider } from './app/dataSource'
import { createDataSource } from './app/createDataSource'

const handle = createDataSource(import.meta.env)
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider value={handle.dataSource}>
        <App handle={handle} />
      </DataSourceProvider>
    </QueryClientProvider>
  </StrictMode>,
)
