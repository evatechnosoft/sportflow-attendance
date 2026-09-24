import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { DataSourceProvider } from './app/dataSource'
import { createDataSource } from './app/createDataSource'
import { SelectionProvider } from './app/selection'

const handle = createDataSource(import.meta.env)
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider value={handle.dataSource}>
        <SelectionProvider>
          <App handle={handle} />
        </SelectionProvider>
      </DataSourceProvider>
    </QueryClientProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => console.error('SW kaydı başarısız', err))
  })
}
