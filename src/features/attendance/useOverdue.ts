import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { DEFAULT_CLUB_SETTINGS, type Id } from '../../domain/types'

const NONE: ReadonlySet<Id> = new Set()

/**
 * Grubun aidatı gecikmiş sporcuları. Aidat işareti kapalıysa sorgu hiç atılmaz.
 * Ayar okunamazsa varsayılana düşer; aidat okunamazsa rozet sessizce çıkmaz.
 */
export function useOverdue(groupId: Id): ReadonlySet<Id> {
  const db = useDataSource()
  const settings = useQuery({
    queryKey: ['club-settings'],
    queryFn: () => db.settings.get().catch(() => DEFAULT_CLUB_SETTINGS),
  })
  const enabled = Boolean(groupId) && settings.data?.fields.dues === true
  const overdue = useQuery({
    queryKey: ['dues-overdue', groupId],
    enabled,
    queryFn: async () => new Set(await db.dues.overdueByGroup(groupId)),
  })
  return enabled ? (overdue.data ?? NONE) : NONE
}
