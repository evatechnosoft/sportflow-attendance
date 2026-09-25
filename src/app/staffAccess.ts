import { FirebaseError } from 'firebase/app'

// Kept identical in clubcrm and sportflow (src/app/staffAccess.ts): both apps
// share one origin, one sign-in and one view-role choice.

export type StaffRole = 'admin' | 'memur' | 'koc'

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = { admin: 'Admin', memur: 'Memur', koc: 'Koç' }

/**
 * Same list as isBootstrap() in clubcrm firestore.rules: admins even without a
 * staff record, so the first staff records can be written.
 */
export const BOOTSTRAP_ADMINS: readonly string[] = ['anadolusporduyuru@gmail.com', 'deancjx@gmail.com']

/** Lowest to highest: admin ⊇ memur ⊇ koc. */
const RANK: readonly StaffRole[] = ['koc', 'memur', 'admin']

const isStaffRole = (value: unknown): value is StaffRole =>
  typeof value === 'string' && (RANK as readonly string[]).includes(value)

export interface StaffAccess {
  /** Every role the person may view as, highest first. */
  roles: StaffRole[]
  groupIds: string[]
  displayName: string | null
}

/** Held roles expanded down the hierarchy, highest first: ['memur'] → ['memur', 'koc']. */
export function ownedRoles(held: readonly StaffRole[]): StaffRole[] {
  const top = Math.max(-1, ...held.map((role) => RANK.indexOf(role)))
  return RANK.slice(0, top + 1).reverse()
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/**
 * Reads staff/{emailLower}. `readStaff` returns the document data or null when
 * it does not exist. permission-denied counts as "no record" (the rules may not
 * let this person read yet); any other failure is rethrown. Null = no role.
 */
export async function resolveAccess(
  email: string,
  readStaff: (emailLower: string) => Promise<unknown>,
): Promise<StaffAccess | null> {
  const emailLower = email.trim().toLowerCase()
  let data: unknown = null
  try {
    data = await readStaff(emailLower)
  } catch (cause) {
    if (!(cause instanceof FirebaseError && cause.code === 'permission-denied')) throw cause
  }

  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  const held = stringList(record.roles).filter(isStaffRole)
  if (BOOTSTRAP_ADMINS.includes(emailLower)) held.push('admin')

  const roles = ownedRoles(held)
  if (roles.length === 0) return null
  return {
    roles,
    groupIds: stringList(record.groupIds),
    displayName: typeof record.displayName === 'string' && record.displayName ? record.displayName : null,
  }
}

/** The requested view role if the person owns it, otherwise their highest role. */
export function pickViewRole(owned: readonly StaffRole[], requested: string | null): StaffRole | null {
  return owned.find((role) => role === requested) ?? owned[0] ?? null
}

const VIEW_ROLE_KEY = 'anadoluspor.viewRole'

export function readViewRole(): string | null {
  try {
    return localStorage.getItem(VIEW_ROLE_KEY)
  } catch {
    return null
  }
}

export function storeViewRole(role: StaffRole): void {
  try {
    localStorage.setItem(VIEW_ROLE_KEY, role)
  } catch {
    // Storage blocked (private window): the choice lasts for this page only.
  }
}
