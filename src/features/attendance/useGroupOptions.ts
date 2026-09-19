import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'

export interface GroupOption {
  id: string
  label: string
  schoolName: string
  branchName: string
  coachName?: string
}

/** Grup listesini okul/branş adlarıyla birleştirir — UI id çözmekle uğraşmasın. */
export function useGroupOptions() {
  const db = useDataSource()
  return useQuery({
    queryKey: ['group-options'],
    queryFn: async (): Promise<GroupOption[]> => {
      const [groups, schools, branches] = await Promise.all([
        db.groups.list(),
        db.schools.list(),
        db.branches.list(),
      ])
      const schoolName = new Map(schools.map((row) => [row.id, row.name]))
      const branchName = new Map(branches.map((row) => [row.id, row.name]))
      return groups.map((group) => ({
        id: group.id,
        label: group.name,
        schoolName: schoolName.get(group.schoolId) ?? '—',
        branchName: branchName.get(group.branchId) ?? '—',
        coachName: group.coachName,
      }))
    },
  })
}
