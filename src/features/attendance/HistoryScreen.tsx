import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '../../app/dataSource'
import { useSelection } from '../../app/selection'
import { SessionHistory } from './SessionHistory'

/** Geçmiş sekmesi: grup Yoklama sekmesinden gelir, tarihe dokununca oraya dönülür. */
export function HistoryScreen({ onPick }: { onPick: () => void }) {
  const db = useDataSource()
  const { groupId, date, setDate } = useSelection()

  const history = useQuery({
    queryKey: ['history', groupId],
    enabled: Boolean(groupId),
    queryFn: () => db.attendance.historyByGroup(groupId),
  })

  if (!groupId) {
    return (
      <p className="rounded-[20px] border border-line bg-surface px-4 py-6 text-center text-sm text-ink-2">
        Önce Yoklama sekmesinden grup seç.
      </p>
    )
  }

  return (
    <SessionHistory
      history={history.data ?? []}
      selectedDate={date}
      onPick={(iso) => {
        setDate(iso)
        onPick()
      }}
    />
  )
}
