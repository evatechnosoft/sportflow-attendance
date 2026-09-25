import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import type { StaffAuthState } from './app/auth'
import type { StaffRole } from './app/staffAccess'
import { createDataSource } from './app/createDataSource'
import { DataSourceProvider } from './app/dataSource'
import { SelectionProvider } from './app/selection'

// Firebase Auth is mocked: the hook returns whatever state the test sets.
const auth = vi.hoisted(() => ({
  state: { status: 'off' } as StaffAuthState,
  signIn: vi.fn(),
  signOutUser: vi.fn(),
}))
vi.mock('./app/auth', async (importActual) => ({
  ...(await importActual<typeof import('./app/auth')>()),
  useStaffAuth: () => auth,
}))

const ready = (roles: StaffRole[]): StaffAuthState => ({
  status: 'ready',
  email: 'hoca@x.com',
  displayName: 'Elif Kaya',
  access: { roles, groupIds: [], displayName: 'Elif Kaya' },
})

function renderApp(state: StaffAuthState) {
  auth.state = state
  const handle = createDataSource({} as ImportMetaEnv)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DataSourceProvider value={handle.dataSource}>
        <SelectionProvider>
          <App handle={handle} />
        </SelectionProvider>
      </DataSourceProvider>
    </QueryClientProvider>,
  )
}

// Node's own (non-functional) localStorage shadows jsdom's: in-memory stand-in.
const stored = new Map<string, string>()
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  })
})
afterEach(() => {
  cleanup()
  stored.clear()
  vi.unstubAllGlobals()
})

describe('App giriş ve roller', () => {
  it('girişsiz açılış giriş ekranını gösterir', async () => {
    renderApp({ status: 'signedOut', error: '' })
    await userEvent.click(screen.getByRole('button', { name: 'Google ile giriş yap' }))
    expect(auth.signIn).toHaveBeenCalled()
    expect(screen.getByText('İstanbul Anadolu Gençlik ve Spor Kulübü')).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Yönetim' })).toBeNull()
  })

  it('rolü olmayan hesap yetki yok ekranı + çıkış görür', async () => {
    renderApp({ status: 'noAccess', email: 'yabanci@x.com' })
    expect(screen.getByText('Bu hesabın kulüpte yetkisi yok.')).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }))
    expect(auth.signOutUser).toHaveBeenCalled()
  })

  it('koç Yönetim bağlantısını görmez, tek rol olduğu için seçici de yok', () => {
    renderApp(ready(['koc']))
    expect(screen.getByText('Elif Kaya')).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Yönetim' })).toBeNull()
    expect(screen.queryByLabelText('Görünüm')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tanımlar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sporcular' })).toBeDefined()
  })

  it('koç Sporcular sekmesinde sporcu ekleyemez', async () => {
    renderApp(ready(['koc']))
    await userEvent.click(screen.getByRole('button', { name: 'Sporcular' }))
    expect(await screen.findByText(/aktif/)).toBeDefined()
    expect(screen.queryByRole('button', { name: /Sporcu ekle/ })).toBeNull()
  })

  it('Tanımlar açıkken koç görünümüne geçilirse sekme gizlenir, Yoklama açılır', async () => {
    renderApp(ready(['admin', 'memur', 'koc']))
    await userEvent.click(screen.getByRole('button', { name: 'Tanımlar' }))
    expect(screen.getByRole('button', { name: 'Tanımlar' }).getAttribute('aria-current')).toBe('page')
    await userEvent.selectOptions(screen.getByLabelText('Görünüm'), 'koc')
    expect(screen.queryByRole('button', { name: 'Tanımlar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Yoklama' }).getAttribute('aria-current')).toBe('page')
  })

  it('admin Yönetim bağlantısını görür; koç görünümüne geçince gizlenir', async () => {
    renderApp(ready(['admin', 'memur', 'koc']))
    expect(screen.getByRole('link', { name: 'Yönetim' }).getAttribute('href')).toBe('/yonetim/')
    await userEvent.selectOptions(screen.getByLabelText('Görünüm'), 'koc')
    expect(screen.queryByRole('link', { name: 'Yönetim' })).toBeNull()
    expect(stored.get('anadoluspor.viewRole')).toBe('koc')
  })

  it('saklı görünüm sahip olunmayan rolse yok sayılır', () => {
    stored.set('anadoluspor.viewRole', 'admin')
    renderApp(ready(['memur', 'koc']))
    expect((screen.getByLabelText('Görünüm') as HTMLSelectElement).value).toBe('memur')
  })
})
