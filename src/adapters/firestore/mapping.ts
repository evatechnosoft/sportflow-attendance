import type { AttendanceStatus, Group, Player } from '../../domain/types'

/**
 * Anadolu Spor Firestore şeması ile bu uygulamanın domain'i arasındaki çeviri.
 * Eski şemada okul kavramı yok (athletes: groupId/branchId/coachId), yoklama
 * durumları Türkçe string. Çeviri saf tutulur ki testi ucuz olsun.
 */

export const UNASSIGNED_SCHOOL = 'school-unassigned'

const STATUS_FROM_FIRESTORE: Record<string, AttendanceStatus> = {
  Geldi: 'present',
  Gelmedi: 'absent',
  Geç: 'late',
  İzinli: 'excused',
}

const STATUS_TO_FIRESTORE: Record<AttendanceStatus, string> = {
  present: 'Geldi',
  absent: 'Gelmedi',
  late: 'Geç',
  excused: 'İzinli',
}

/** 'Belirsiz' ve tanınmayan değerler kayıt sayılmaz. */
export function toAttendanceStatus(value: unknown): AttendanceStatus | null {
  return typeof value === 'string' ? (STATUS_FROM_FIRESTORE[value] ?? null) : null
}

export function fromAttendanceStatus(status: AttendanceStatus): string {
  return STATUS_TO_FIRESTORE[status]
}

export interface FirestoreAthlete {
  fullName?: string
  birthYear?: number
  groupId?: string
  parentName?: string
  parentPhone?: string
  status?: string
}

export function toPlayer(id: string, raw: FirestoreAthlete): Player {
  const fullName = (raw.fullName ?? '').trim()
  // Eski veride "Grup - Ad Soyad" biçimi de var; grup önekini at.
  const withoutPrefix = fullName.includes(' - ')
    ? fullName.split(' - ').slice(1).join(' - ')
    : fullName
  const parts = withoutPrefix.split(/\s+/).filter(Boolean)

  return {
    id,
    firstName: parts.slice(0, -1).join(' ') || parts[0] || '(isimsiz)',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    birthDate: raw.birthYear ? `${raw.birthYear}-01-01` : undefined,
    groupId: raw.groupId ?? '',
    status: raw.status === 'approved' ? 'active' : 'inactive',
    guardianName: raw.parentName,
    guardianPhone: raw.parentPhone,
  }
}

export interface FirestoreGroup {
  name?: string
  branchId?: string
  schoolId?: string
  coachId?: string
  startTime?: string
  sessionTime?: string
}

export function toGroup(id: string, raw: FirestoreGroup): Group {
  return {
    id,
    name: raw.name ?? '(isimsiz grup)',
    branchId: raw.branchId ?? '',
    schoolId: raw.schoolId ?? UNASSIGNED_SCHOOL,
    coachName: raw.coachId,
    schedule: [],
  }
}

/** Eski uygulamanın yoklama belge kimliği: groups ve tarih birleşimi. */
export function sessionDocId(groupId: string, date: string): string {
  return `${groupId}_${date}`
}

export interface FirestoreSettings {
  branches?: { id?: string; name?: string; slug?: string }[]
  loginTitlePrimary?: string
  loginTitleSecondary?: string
  loginDescription?: string
}

/** Kulübün adı settings/features içinde; giriş ekranı metinleri oradan gelir. */
export function toClubIdentity(raw: FirestoreSettings | undefined) {
  return {
    primaryName: (raw?.loginTitlePrimary ?? 'SPORTFLOW').trim(),
    secondaryName: (raw?.loginTitleSecondary ?? '').trim(),
    description: (raw?.loginDescription ?? '').trim(),
  }
}

/** Branşlar ayrı koleksiyonda değil, settings/features belgesindeki dizide tutulur. */
export function toBranches(raw: FirestoreSettings | undefined) {
  return (raw?.branches ?? []).map((branch, index) => ({
    id: branch.id ?? `branch-${index + 1}`,
    name: branch.name ?? '(isimsiz branş)',
    slug: branch.slug ?? branch.id ?? `branch-${index + 1}`,
  }))
}

export interface AttendanceDocInput {
  groupId: string
  date: string
  coachId: string
  records: Record<string, { status: string; notes: string }>
  createdAt?: number
}

/**
 * firestore.rules § isValidAttendance: groupId, coachId, date, createdAt, records
 * alanlarının beşi de zorunlu; createdAt sayı, type verilirse practice|match olmalı.
 */
export function buildAttendanceDoc(input: AttendanceDocInput) {
  return {
    groupId: input.groupId,
    date: input.date,
    coachId: input.coachId,
    createdAt: input.createdAt ?? Date.now(),
    type: 'practice' as const,
    records: input.records,
  }
}
