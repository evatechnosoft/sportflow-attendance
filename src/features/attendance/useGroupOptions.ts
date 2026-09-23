import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { DEFAULT_CLUB_SETTINGS, type ScheduleSlot } from '../../domain/types'
import { scheduleLabel } from '../manage/schedule'

export interface GroupOption {
  id: string
  label: string
  /** Okul yoksa ya da okul alanı kapalıysa tanımsız — ekran o parçayı hiç göstermez. */
  schoolName?: string
  branchName: string
  coachName?: string
  schedule: ScheduleSlot[]
  /** "Salı 17:00 · Cumartesi 10:00"; takvim boşsa boş metin. */
  scheduleText: string
}

/** Boş parçaları atıp " · " ile birleştirir; eksik alan ayırıcı bırakmaz. */
export const joinParts = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

/** Grup listesini okul/branş adlarıyla birleştirir — UI id çözmekle uğraşmasın. */
export function useGroupOptions() {
  const db = useDataSource()
  return useQuery({
    queryKey: ['group-options'],
    queryFn: async (): Promise<GroupOption[]> => {
      // Gruplar zorunlu; okul/branş adları süstür. Biri reddedilirse liste yine gelsin.
      const groups = await db.groups.list()
      const [schools, branches, settings] = await Promise.all([
        db.schools.list().catch(() => []),
        db.branches.list().catch(() => []),
        db.settings.get().catch(() => DEFAULT_CLUB_SETTINGS),
      ])
      const schoolName = new Map(schools.map((row) => [row.id, row.name]))
      const branchName = new Map(branches.map((row) => [row.id, row.name]))
      return groups.map((group) => ({
        id: group.id,
        label: group.name,
        schoolName:
          settings.fields.school && group.schoolId ? schoolName.get(group.schoolId) : undefined,
        branchName: branchName.get(group.branchId) ?? '—',
        coachName: group.coachName,
        schedule: group.schedule,
        scheduleText: scheduleLabel(group.schedule),
      }))
    },
  })
}
