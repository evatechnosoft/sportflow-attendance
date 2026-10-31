import { afterEach, describe, expect, it } from 'vitest'
import { FEATURE_KEYS, isFeatureOn, remoteFlagParam, remoteFlagsFrom, setFlagsForTest } from './remoteFlags'

describe('remoteFlags', () => {
  afterEach(() => setFlagsForTest({}))

  it('uses feature_<key> parameter names', () => {
    expect(remoteFlagParam('history')).toBe('feature_history')
  })

  it('reads every key from the getter', () => {
    const seen: string[] = []
    const out = remoteFlagsFrom((p) => {
      seen.push(p)
      return p !== 'feature_evaluations'
    })
    expect(seen).toEqual(FEATURE_KEYS.map(remoteFlagParam))
    expect(out).toEqual({ history: true, announcements: true, evaluations: false })
  })

  it('defaults to on and can be switched off', () => {
    expect(isFeatureOn('history')).toBe(true)
    setFlagsForTest({ history: false })
    expect(isFeatureOn('history')).toBe(false)
    expect(isFeatureOn('announcements')).toBe(true)
  })
})
