import { describe, expect, it } from 'vitest'
import { createDataSource } from './createDataSource'

const env = (values: Record<string, string>) => values as unknown as ImportMetaEnv

describe('createDataSource', () => {
  it('varsayılan mock adapter döner', () => {
    const handle = createDataSource(env({}))
    expect(handle.kind).toBe('mock')
    expect(handle.requiresAuth).toBe(false)
  })

  it('firestore istense de env eksikse mock kalır — uygulama açılmayı sürdürür', () => {
    const handle = createDataSource(env({ VITE_DATA_SOURCE: 'firestore' }))
    expect(handle.kind).toBe('mock')
  })

  it('mock adapter seed ile dolu gelir', async () => {
    const { dataSource } = createDataSource(env({}))
    expect((await dataSource.groups.list()).length).toBeGreaterThan(0)
  })
})
