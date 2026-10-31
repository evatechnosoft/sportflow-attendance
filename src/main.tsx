import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from './app/queryClient'
import './index.css'
import App from './App'
import { DataSourceProvider } from './app/dataSource'
import { createDataSource } from './app/createDataSource'
import { SelectionProvider } from './app/selection'
import { initFirebase, readFirebaseEnv } from './adapters/firestore/firebase'
import { loadRemoteFeatureFlags } from './app/remoteFlags'

const firebaseConfig = readFirebaseEnv(import.meta.env)
// Activates cached kill-switches before first render; never blocks on the network.
if (firebaseConfig?.appId) await loadRemoteFeatureFlags(initFirebase(firebaseConfig).app)

const handle = createDataSource(import.meta.env)
const queryClient = createQueryClient()

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
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err: unknown) => console.error('SW kaydı başarısız', err))
  })
}
