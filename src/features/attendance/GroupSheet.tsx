import { useDialog } from '../../app/useDialog'
import { joinParts, type GroupOption } from './useGroupOptions'

/** Grup seçimi için alttan açılan yerel <dialog>. */
export function GroupSheet({
  open,
  groups,
  groupId,
  onSelect,
  onClose,
}: {
  open: boolean
  groups: GroupOption[]
  groupId: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const ref = useDialog(open)

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={onClose}>
      <div
        className="rounded-t-[26px] bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
      >
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
      </div>
    </dialog>
  )
}
