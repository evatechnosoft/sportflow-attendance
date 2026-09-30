import { createContext, useContext, useEffect, useState } from 'react'
import { ANNOUNCEMENT_MAX, validateAnnouncement, whatsappShare, type Announcement, type AnnouncementSource } from './announcements'

/** Firestore + girişte dolu; yerel modda null (bölüm görünmez). */
export const AnnouncementsContext = createContext<AnnouncementSource | null>(null)

/**
 * Sahada kısa duyuru: "antrenman ertelendi", "maçımız var". Veli portalında görünür;
 * WhatsApp'ta paylaş kulübün veli grubunu seçtirir.
 */
export function CoachAnnouncements({ groupId }: { groupId: string }) {
  const source = useContext(AnnouncementsContext)
  const [items, setItems] = useState<Announcement[]>([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!source || !groupId) return
    let active = true
    source.listByGroup(groupId).then(
      (rows) => active && setItems(rows.slice(0, 3)),
      () => active && setItems([]),
    )
    return () => {
      active = false
    }
  }, [source, groupId, version])

  if (!source || !groupId) return null

  async function submit() {
    const invalid = validateAnnouncement(text)
    if (invalid) return setError(invalid)
    try {
      await source!.create({ groupIds: [groupId], text })
      setText('')
      setOpen(false)
      setError(null)
      setVersion((v) => v + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Duyuru kaydedilemedi.')
    }
  }

  return (
    <section id="duyurular" aria-label="Duyurular" className="mt-6 scroll-mt-4 space-y-2 rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-2">Duyurular</h2>
        <button type="button" onClick={() => setOpen(!open)} className="min-h-11 px-2 text-sm font-semibold text-accent">
          {open ? 'Kapat' : '+ Duyuru'}
        </button>
      </div>
      {open && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-2">
            Veliler görecek
            <textarea
              value={text}
              rows={2}
              maxLength={ANNOUNCEMENT_MAX}
              placeholder="Örn. Bugünkü antrenman 18:00'e ertelendi."
              onChange={(event) => setText(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-bg p-2 text-base text-ink"
            />
          </label>
          <button type="button" onClick={() => void submit()} className="h-11 w-full rounded-xl bg-accent font-bold text-bg">
            Duyur
          </button>
        </div>
      )}
      {error && <p className="text-sm font-medium text-absent">{error}</p>}
      {items.length === 0 && !open && <p className="text-sm text-ink-2">Bu grupta duyuru yok.</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <p className="whitespace-pre-wrap text-ink">{item.text}</p>
            <p className="flex items-center justify-between gap-2 text-xs text-ink-2">
              <span>
                {item.createdAt.slice(8, 10)}.{item.createdAt.slice(5, 7)} · {item.createdByName}
              </span>
              <a href={whatsappShare(item.text)} target="_blank" rel="noopener" className="font-semibold text-accent">
                WhatsApp'ta paylaş
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
