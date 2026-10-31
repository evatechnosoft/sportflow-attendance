import type { FirebaseApp } from 'firebase/app'
import { activate, fetchConfig, getBoolean, getRemoteConfig, isSupported } from 'firebase/remote-config'

/** Kill-switchable features. Remote Config parameter: `feature_<key>`. */
export const FEATURE_KEYS = ['history', 'announcements', 'evaluations'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const remoteFlagParam = (key: FeatureKey): string => `feature_${key}`

const allOn = (): Record<FeatureKey, boolean> => ({ history: true, announcements: true, evaluations: true })

let flags = allOn()

/** Pure so it is testable without Firebase. Remote can only turn a feature off. */
export function remoteFlagsFrom(getBool: (param: string) => boolean): Record<FeatureKey, boolean> {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, getBool(remoteFlagParam(k))])) as Record<FeatureKey, boolean>
}

export const isFeatureOn = (key: FeatureKey): boolean => flags[key]

/** Test hook. */
export function setFlagsForTest(next: Partial<Record<FeatureKey, boolean>>): void {
  flags = { ...allOn(), ...next }
}

/**
 * Activate the last fetched values (local, no network wait) and fetch in the
 * background for the next launch. Any failure keeps the all-on defaults.
 */
export async function loadRemoteFeatureFlags(app: FirebaseApp): Promise<void> {
  try {
    if (!(await isSupported())) return
    const rc = getRemoteConfig(app)
    rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000
    rc.settings.fetchTimeoutMillis = 10_000
    rc.defaultConfig = Object.fromEntries(FEATURE_KEYS.map((k) => [remoteFlagParam(k), true]))
    await activate(rc)
    flags = remoteFlagsFrom((p) => getBoolean(rc, p))
    void fetchConfig(rc).catch(() => undefined)
  } catch {
    // Remote Config unavailable: keep defaults.
  }
}
