import { useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type PanInfo,
} from 'framer-motion'
import type { AttendanceStatus, Player } from '../../domain/types'
import { STATUSES, STATUS_LABEL } from './summary'
import { isDrag, resolveSwipe, SWIPE_THRESHOLD } from './swipe'

// Tailwind sınıfları statik olmak zorunda (JIT tarama) — bu yüzden tam ad tablosu.
const STRIPE: Record<AttendanceStatus, string> = {
  present: 'bg-present',
  late: 'bg-late',
  excused: 'bg-excused',
  absent: 'bg-absent',
}

const BADGE: Record<AttendanceStatus, string> = {
  present: 'bg-present-soft text-present',
  late: 'bg-late-soft text-late',
  excused: 'bg-excused-soft text-excused',
  absent: 'bg-absent-soft text-absent',
}

const SEGMENT_ACTIVE: Record<AttendanceStatus, string> = {
  present: 'bg-present text-bg',
  late: 'bg-late text-bg',
  excused: 'bg-excused text-bg',
  absent: 'bg-absent text-bg',
}

const LABEL_TEXT: Record<AttendanceStatus, string> = {
  present: 'text-present',
  late: 'text-late',
  excused: 'text-excused',
  absent: 'text-absent',
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function initials(player: Player): string {
  return `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toLocaleUpperCase('tr-TR')
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
  const [armed, setArmed] = useState<AttendanceStatus | null>(null)
  const dragged = useRef(false)
  const x = useMotionValue(0)

  const presentScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.6, 1], { clamp: true })
  const absentScale = useTransform(x, [0, -SWIPE_THRESHOLD], [0.6, 1], { clamp: true })

  useMotionValueEvent(x, 'change', (value) => {
    const next: AttendanceStatus | null =
      value > SWIPE_THRESHOLD ? 'present' : value < -SWIPE_THRESHOLD ? 'absent' : null
    if (next === armed) return
    if (next) navigator.vibrate?.(10)
    setArmed(next)
  })

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    dragged.current = isDrag(info.offset.x)
    const next = resolveSwipe(info.offset.x, info.velocity.x)
    if (next) onChange(next)
    setArmed(null)
    // Kaydırma bittikten hemen sonra gelen click'i yut (kart açılmasın).
    setTimeout(() => {
      dragged.current = false
    }, 50)
  }

  const fullName = `${player.firstName} ${player.lastName}`

  return (
    <li className="relative select-none overflow-hidden rounded-2xl">
      {/* Kaydırma altındaki eylem alanları: sağa → Var, sola → Yok */}
      <div className="absolute inset-0 flex items-stretch justify-between" aria-hidden="true">
        <div
          className={`flex w-1/2 items-center gap-2 px-5 text-sm font-semibold ${
            armed === 'present' ? 'bg-present text-bg' : 'bg-present-soft text-present'
          }`}
        >
          <motion.span style={{ scale: presentScale, opacity: presentScale }}>
            <CheckIcon />
          </motion.span>
          <span>Var</span>
        </div>
        <div
          className={`flex w-1/2 items-center justify-end gap-2 px-5 text-sm font-semibold ${
            armed === 'absent' ? 'bg-absent text-bg' : 'bg-absent-soft text-absent'
          }`}
        >
          <span>Yok</span>
          <motion.span style={{ scale: absentScale, opacity: absentScale }}>
            <XIcon />
          </motion.span>
        </div>
      </div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={1}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 32 }}
        onDragEnd={handleDragEnd}
        className="relative overflow-hidden rounded-2xl border border-line bg-surface"
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={fullName}
          onClick={() => {
            if (!dragged.current) setExpanded((prev) => !prev)
          }}
          className="flex min-h-[72px] w-full items-center gap-3 pr-4 text-left"
        >
          <span className={`h-[72px] w-1 shrink-0 ${status ? STRIPE[status] : 'bg-line'}`} />
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              status ? BADGE[status] : 'bg-surface-2 text-ink-2'
            }`}
          >
            {initials(player)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{fullName}</span>
            {expanded && (
              <span className="mt-0.5 block truncate text-xs text-ink-3">
                {player.guardianName ? `Veli: ${player.guardianName}` : 'Veli bilgisi yok'}
                {player.guardianPhone ? ` · ${player.guardianPhone}` : ''}
              </span>
            )}
          </span>
          <span className={`shrink-0 text-xs font-semibold ${status ? LABEL_TEXT[status] : 'text-ink-3'}`}>
            {status ? STATUS_LABEL[status] : '—'}
          </span>
        </button>

        {expanded && (
          <div className="flex gap-1 border-t border-line p-1">
            {STATUSES.map((value) => {
              const active = status === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(value)}
                  className={`min-h-11 flex-1 rounded-xl text-sm font-medium transition ${
                    active ? SEGMENT_ACTIVE[value] : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  {STATUS_LABEL[value]}
                </button>
              )
            })}
          </div>
        )}
      </motion.div>
    </li>
  )
}
