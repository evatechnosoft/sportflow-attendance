import { describe, expect, it } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { ownedRoles, resolveAccess } from './staffAccess'

const records = (docs: Record<string, unknown>) => async (id: string) => docs[id] ?? null

describe('resolveAccess', () => {
  it('bootstrap e-postası staff kaydı olmadan admin sayılır (büyük harf fark etmez)', async () => {
    const access = await resolveAccess('DeanCJX@gmail.com', records({}))
    expect(access?.roles).toEqual(['admin', 'memur', 'koc'])
  })

  it('staff kaydındaki rol hiyerarşiyle genişler, gruplar ve ad gelir', async () => {
    const read = records({ 'hoca@x.com': { roles: ['koc'], groupIds: ['g1'], displayName: 'Hoca' } })
    expect(await resolveAccess('hoca@x.com', read)).toEqual({ roles: ['koc'], groupIds: ['g1'], displayName: 'Hoca' })
    const memur = await resolveAccess('m@x.com', records({ 'm@x.com': { roles: ['memur'], groupIds: [] } }))
    expect(memur?.roles).toEqual(['memur', 'koc'])
  })

  it('kaydı olmayan veya tanınmayan rolü olan kişinin rolü yok', async () => {
    expect(await resolveAccess('yok@x.com', records({}))).toBeNull()
    expect(await resolveAccess('v@x.com', records({ 'v@x.com': { roles: ['veli'] } }))).toBeNull()
  })

  it('permission-denied = rol yok; bootstrap yine admin', async () => {
    const denied = async () => {
      throw new FirebaseError('permission-denied', 'Missing or insufficient permissions.')
    }
    expect(await resolveAccess('yok@x.com', denied)).toBeNull()
    expect((await resolveAccess('anadolusporduyuru@gmail.com', denied))?.roles[0]).toBe('admin')
  })

  it('başka hatalar yutulmaz', async () => {
    const offline = async () => {
      throw new FirebaseError('unavailable', 'offline')
    }
    await expect(resolveAccess('x@x.com', offline)).rejects.toThrow('offline')
  })
})

describe('ownedRoles', () => {
  it('ownedRoles boş listede boş döner', () => {
    expect(ownedRoles([])).toEqual([])
  })
})
