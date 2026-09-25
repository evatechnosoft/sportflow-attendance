import { useEffect, useRef, type ReactNode } from 'react'

const DESKTOP = '(min-width: 768px)'
const GAP = 8

/**
 * Yerel <dialog> kabuğu; içeriği çağıran belirler. Telefonda alttan açılan sayfa,
 * masaüstünde `anchor` varsa onun altına hizalı açılır, yoksa ortada modal olur.
 * jsdom'da showModal yok — orada `open` özniteliği elle konur ki test içeriği görebilsin.
 */
export function Sheet({
  open,
  onClose,
  anchor,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Element that opened the sheet; on desktop the dialog is placed under it. */
  anchor?: HTMLElement | null
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!open) {
      node.close?.()
      node.removeAttribute('open')
      return
    }
    if (node.showModal) node.showModal()
    else node.setAttribute('open', '')
  }, [open])

  useEffect(() => {
    const node = ref.current
    if (!node || !open || !anchor) return
    const place = () => {
      if (!window.matchMedia?.(DESKTOP).matches) {
        node.removeAttribute('data-anchored')
        node.style.cssText = ''
        return
      }
      const rect = anchor.getBoundingClientRect()
      const width = Math.min(Math.max(rect.width, 320), 448, window.innerWidth - GAP * 2)
      // Left-align with the trigger; right-align when that would overflow the viewport.
      const start = rect.left + width > window.innerWidth - GAP ? rect.right - width : rect.left
      const left = Math.min(Math.max(start, GAP), window.innerWidth - width - GAP)
      node.setAttribute('data-anchored', '')
      node.style.width = `${width}px`
      node.style.left = `${left}px`
      node.style.maxHeight = ''
      const height = node.offsetHeight
      const below = window.innerHeight - rect.bottom - GAP * 2
      // Flip above the trigger only when it fits better there.
      const top =
        height <= below || rect.top < below
          ? rect.bottom + GAP
          : Math.max(rect.top - height - GAP, GAP)
      node.style.top = `${top}px`
      node.style.maxHeight = `${window.innerHeight - top - GAP}px`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      node.removeAttribute('data-anchored')
      node.style.cssText = ''
    }
  }, [open, anchor])

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={onClose}>
      <div
        className="rounded-t-[26px] bg-surface p-4 md:rounded-[20px] md:border md:border-line md:shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </dialog>
  )
}
