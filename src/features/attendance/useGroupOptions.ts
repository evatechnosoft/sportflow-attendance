import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import type { ScheduleSlot } from '../../domain/types'
import { scheduleLabel } from '../manage/schedule'

export interface GroupOption {
  id: string
  label: string
  schoolName: string
  branchName: string
  coachName?: string
  schedule: ScheduleSlot[]
  /** "Salı 17:00 · Cumartesi 10:00"; takvim boşsa boş metin. */
  scheduleText: string
}

/** Grup listesini okul/branş adlarıyla birleştirir — UI id çözmekle uğraşmasın. */
export function useGroupOptions() {
  const db = useDataSource()
  return useQuery({
    queryKey: ['group-options'],
    queryFn: async (): Promise<GroupOption[]> => {
      // Gruplar zorunlu; okul/branş adları süstür. Biri reddedilirse liste yine gelsin.
      const groups = await db.groups.list()
      const [schools, branches] = await Promise.all([
        db.schools.list().catch(() => []),
        db.branches.list().catch(() => []),
      ])
      const schoolName = new Map(schools.map((row) => [row.id, row.name]))
      const branchName = new Map(branches.map((row) => [row.id, row.name]))
      return groups.map((group) => ({
        id: group.id,
        label: group.name,
        schoolName: schoolName.get(group.schoolId) ?? '—',
        branchName: branchName.get(group.branchId) ?? '—',
        coachName: group.coachName,
        schedule: group.schedule,
        scheduleText: scheduleLabel(group.schedule),
      }))
    },
  })
}
