import { Sheet } from '../../app/Sheet'
import { joinParts, type GroupOption } from './useGroupOptions'

/** Grup seçimi; masaüstünde `anchor` altında açılır. */
export function GroupSheet({
  open,
  groups,
  groupId,
  onSelect,
  onClose,
  anchor,
}: {
  open: boolean
  anchor?: HTMLElement | null
  groups: GroupOption[]
  groupId: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} anchor={anchor}>
      <p className="mb-3 font-display text-lg font-semibold">Grup seç</p>
      <div className="space-y-1">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            aria-pressed={group.id === groupId}
            onClick={() => {
              onSelect(group.id)
              onClose()
            }}
            className={`flex h-[52px] w-full items-center justify-between rounded-2xl px-4 text-left ${
              group.id === groupId ? 'bg-brand text-bg' : 'bg-surface-2 text-ink'
            }`}
          >
            <span className="truncate font-medium">{group.label}</span>
            <span className="ml-3 shrink-0 truncate text-xs opacity-70">
              {group.scheduleText || joinParts(group.schoolName, group.branchName)}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
