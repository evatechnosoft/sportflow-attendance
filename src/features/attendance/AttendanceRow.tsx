import { useRef, useState } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import type { AttendanceStatus, Player } from '../../domain/types'
import { isDrag, resolveSwipe } from './swipe'

export const STATUS_BUTTONS: { value: AttendanceStatus; label: string; classes: string }[] = [
  { value: 'present', label: 'Var', classes: 'bg-brand text-white' },
  { value: 'late', label: 'Geç', classes: 'bg-warn text-white' },
  { value: 'excused', label: 'İzinli', classes: 'bg-ink/70 text-white' },
  { value: 'absent', label: 'Yok', classes: 'bg-danger text-white' },
]

const CARD_TINT: Record<AttendanceStatus, string> = {
  present: 'border-brand/40 bg-brand/5',
  late: 'border-warn/40 bg-warn/5',
  excused: 'border-ink/20 bg-ink/5',
  absent: 'border-danger/40 bg-danger/5',
}

export function AttendanceRow({
  player,
  status,
  onChange,
}: {
  player: Player
  status?: AttendanceStatus
  onChange: (status: AttendanceStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dragged = useRef(false)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    dragged.current = isDrag(info.offset.x)
    const next = resolveSwipe(info.offset.x)
    if (next) onChange(next)
    // Kaydırma bittikten hemen sonra gelen click'i yut (kart açılmasın).
    setTimeout(() => {
      dragged.current = false
    }, 50)
  }

  return (
    <li className="relative select-none">
      {/* Kart altındaki ipucu: sağa = geldi, sola = gelmedi */}
      <div className="absolute inset-0 flex items-center justify-between rounded-2xl bg-surface px-5 text-xs font-semibold">
        <span className="text-brand">← Var</span>
        <span className="text-danger">Yok →</span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (!dragged.current) setExpanded((prev) => !prev)
        }}
        whileTap={{ cursor: 'grabbing' }}
        className={`relative flex cursor-grab flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white px-4 py-3 shadow-sm ${
          status ? CARD_TINT[status] : 'border-transparent'
        }`}
      >
        <div>
          <p className="font-medium">
            {player.firstName} {player.lastName}
          </p>
          {expanded && (
            <p className="mt-1 text-xs text-ink/50">
              {player.guardianName ? `Veli: ${player.guardianName}` : 'Veli bilgisi yok'}
              {player.guardianPhone ? ` · ${player.guardianPhone}` : ''}
            </p>
          )}
        </div>

        <div className="flex gap-1">
          {STATUS_BUTTONS.map((button) => {
            const active = status === button.value
            return (
              <button
                key={button.value}
                type="button"
                aria-pressed={active}
                onClick={(event) => {
                  event.stopPropagation()
                  onChange(button.value)
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? button.classes : 'bg-surface text-ink/50 hover:text-ink'
                }`}
              >
                {button.label}
              </button>
            )
          })}
        </div>
      </motion.div>
    </li>
  )
}
