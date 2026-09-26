import type { AttendanceStatus, Gender, Group, GroupSpell, Player, ScheduleSlot } from '../../domain/types'
import type { AttendanceMark } from '../../ports/repositories'

/**
 * CRM v2 Firestore sözleşmesi ile yoklama domain'i arasındaki çeviri
 * (clubcrm docs/faz-b-kurgu.md § B3/B4 Firestore sözleşmesi). Kadro CRM'in:
 * students + memberships + guardianships → customers. Çeviri saf tutulur ki testi ucuz olsun.
 */

const STATUSES: readonly AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

/** Tanınmayan değer kayıt sayılmaz. */
export function toAttendanceStatus(value: unknown): AttendanceStatus | null {
  return STATUSES.find((status) => status === value) ?? null
}

export interface GroupDoc {
  name?: string
  kind?: string
  branchId?: string
  schoolId?: string
  coachName?: string
  schedule?: ScheduleSlot[]
}

/** CRM grubunda yoklamanın ek alanları yok: branş boş, takvim boş gelir. */
export function toGroup(id: string, raw: GroupDoc): Group {
  return {
    id,
    name: raw.name ?? '',
    branchId: raw.branchId ?? '',
    schoolId: raw.schoolId || undefined,
    coachName: raw.coachName || undefined,
    schedule: raw.schedule ?? [],
  }
}

export interface StudentDoc {
  firstName?: string
  lastName?: string
  birthDate?: string
  status?: string
  gender?: string
}

/**
 * students.groupIds: açık üyeliği olan gruplar (denormalize). Kural koçun okumasını
 * buna göre verir; üyelik yazan her işlem aynı batch'te günceller.
 */
export function openGroupIds(spells: readonly { groupId: string; leftOn?: string }[]): string[] {
  return [...new Set(spells.filter((spell) => !spell.leftOn).map((spell) => spell.groupId))].sort()
}

export interface MembershipDoc {
  id: string
  studentId: string
  groupId: string
  joinedOn: string
  leftOn?: string
}

export interface Guardian {
  fullName?: string
  phone?: string
}

/** Dönem geçmişi öğrencinin üyeliklerinden, joinedOn artan (boş = bilinmiyor, en başta). */
export function toPlayer(
  id: string,
  raw: StudentDoc,
  memberships: MembershipDoc[],
  guardian?: Guardian,
): Player {
  return {
    id,
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    birthDate: raw.birthDate || undefined,
    gender: raw.gender === 'male' || raw.gender === 'female' ? raw.gender : undefined,
    status: raw.status === 'active' ? 'active' : 'inactive',
    guardianName: guardian?.fullName || undefined,
    guardianPhone: guardian?.phone || undefined,
    groupHistory: memberships
      .filter((row) => row.studentId === id)
      .sort((a, b) => a.joinedOn.localeCompare(b.joinedOn))
      .map((row) => ({
        groupId: row.groupId,
        joinedOn: row.joinedOn,
        ...(row.leftOn ? { leftOn: row.leftOn } : {}),
      })),
  }
}

/** CRM `Gender` yalnız male|female; 'other' yazılmaz. */
export function toStudentGender(gender: Gender | undefined): 'male' | 'female' | undefined {
  return gender === 'male' || gender === 'female' ? gender : undefined
}

/** Veli: rank 1 önce; yoksa ilk bulunan. */
export function primaryGuardianId(
  rows: { studentId: string; customerId: string; rank?: number }[],
  studentId: string,
): string | undefined {
  return rows
    .filter((row) => row.studentId === studentId)
    .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))[0]?.customerId
}

export interface MembershipDiff {
  close: { id: string; leftOn: string }[]
  open: { groupId: string; joinedOn: string }[]
}

/**
 * Yeni groupHistory ile mevcut üyelikler arasındaki fark. Açık üyelik, yeni
 * geçmişte o grubun açık dönemi yoksa kapanır; açık dönemin üyeliği yoksa açılır.
 */
export function diffMemberships(
  current: MembershipDoc[],
  next: GroupSpell[],
  today: string,
): MembershipDiff {
  const openNext = next.filter((spell) => !spell.leftOn)
  const openNow = current.filter((row) => !row.leftOn)
  return {
    close: openNow
      .filter((row) => !openNext.some((spell) => spell.groupId === row.groupId))
      .map((row) => ({
        id: row.id,
        leftOn:
          next.find((spell) => spell.groupId === row.groupId && spell.leftOn)?.leftOn ?? today,
      })),
    open: openNext
      .filter((spell) => !openNow.some((row) => row.groupId === spell.groupId))
      .map((spell) => ({ groupId: spell.groupId, joinedOn: spell.joinedOn || today })),
  }
}

/** Yoklama belge kimliği: `attendance/{groupId}_{date}`. */
export function sessionDocId(groupId: string, date: string): string {
  return `${groupId}_${date}`
}

/** Tarih her zaman son parça; grup kimliğinde `_` olsa da bozulmaz. */
export function parseSessionId(sessionId: string): { groupId: string; date: string } | null {
  const cut = sessionId.lastIndexOf('_')
  const groupId = sessionId.slice(0, cut)
  const date = sessionId.slice(cut + 1)
  return cut > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { groupId, date } : null
}

export interface AttendanceRecord {
  status: AttendanceStatus
  note?: string
  markedAt: string
}

/**
 * firestore.rules § isValidAttendance: groupId, date, records (map) ve
 * takenBy == giriş e-postası (küçük harf). `setDoc(..., {merge: true})` ile yazılır.
 */
export function buildAttendanceDoc(input: {
  groupId: string
  date: string
  takenBy: string
  marks: AttendanceMark[]
  now: string
}) {
  const records: Record<string, AttendanceRecord> = {}
  for (const mark of input.marks) {
    records[mark.playerId] = {
      status: mark.status,
      ...(mark.note ? { note: mark.note } : {}),
      markedAt: input.now,
    }
  }
  return {
    groupId: input.groupId,
    date: input.date,
    takenBy: input.takenBy,
    updatedAt: input.now,
    records,
  }
}

/** records haritası → sayılabilir kayıtlar; tanınmayan durum atlanır. */
export function recordsOf(raw: unknown): { playerId: string; record: AttendanceRecord }[] {
  const records = (raw ?? {}) as Record<string, { status?: unknown; note?: unknown; markedAt?: unknown }>
  const rows: { playerId: string; record: AttendanceRecord }[] = []
  for (const [playerId, value] of Object.entries(records)) {
    const status = toAttendanceStatus(value?.status)
    if (!status) continue
    rows.push({
      playerId,
      record: {
        status,
        ...(typeof value.note === 'string' && value.note ? { note: value.note } : {}),
        markedAt: typeof value.markedAt === 'string' ? value.markedAt : '',
      },
    })
  }
  return rows
}

export interface InstallmentDoc {
  planId: string
  dueDate: string
  amount: number
  paidAmount: number
}

/** Vadesi geçmiş (bugünden önce) ve tam ödenmemiş taksit. */
export function isOverdue(row: InstallmentDoc, today: string): boolean {
  return row.dueDate < today && row.paidAmount < row.amount
}

/** Firestore `in` sorgusu en fazla 30 değer alır. */
export function chunks<T>(items: T[], size = 30): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}
