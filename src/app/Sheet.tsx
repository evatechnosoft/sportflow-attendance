import type { ReactNode } from 'react'
import { useDialog } from './useDialog'

/** Alttan açılan yerel <dialog> kabuğu; içeriği çağıran belirler. */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const ref = useDialog(open)
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={onClose}>
      <div className="rounded-t-[26px] bg-surface p-4" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </dialog>
  )
}
