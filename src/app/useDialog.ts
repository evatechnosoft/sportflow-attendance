import { useEffect, useState } from 'react'

/**
 * Yerel <dialog> açıp kapar. jsdom'da showModal yok — orada `open` özniteliği
 * elle konur ki test içeriği görebilsin; tarayıcıda davranış değişmez.
 */
export function useDialog(open: boolean) {
  const [node, setNode] = useState<HTMLDialogElement | null>(null)

  useEffect(() => {
    if (!node) return
    if (!open) {
      node.close?.()
      node.removeAttribute('open')
      return
    }
    if (node.showModal) node.showModal()
    else node.setAttribute('open', '')
  }, [node, open])

  return setNode
}
