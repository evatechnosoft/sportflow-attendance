import type { Skill } from './evaluations'

// Kept identical in clubcrm and sportflow (src/evaluations/RadarChart.tsx).
// Renkler iki uygulamada da tanımlı CSS değişkenlerinden: --accent, --ink, --line.

export interface RadarSeries {
  /** Lejant ve tablo başlığı, ör. tarih. */
  label: string
  values: Record<string, number | undefined>
}

const MAX = 10
// Yatay geniş: uzun etiketler sağa/sola taşar.
const WIDTH = 400
const HEIGHT = 300
const CX = WIDTH / 2
const CY = HEIGHT / 2
const RADIUS = 100
const RINGS = [2, 4, 6, 8, 10]

const fmt = (value: number | undefined) => (value === undefined ? '—' : String(value).replace('.', ','))

/** i. eksenin açısı: tepeden başlar, saat yönünde. */
const angle = (index: number, count: number) => -Math.PI / 2 + (2 * Math.PI * index) / count

const point = (index: number, count: number, value: number) => {
  const r = (Math.max(0, Math.min(MAX, value)) / MAX) * RADIUS
  return [CX + r * Math.cos(angle(index, count)), CY + r * Math.sin(angle(index, count))] as const
}

const polygon = (axes: Skill[], values: RadarSeries['values']) =>
  axes.map((axis, index) => point(index, axes.length, values[axis.key] ?? 0).join(',')).join(' ')

/** Uzun etiket ilk boşluktan iki satıra bölünür. */
const lines = (label: string) => {
  const space = label.indexOf(' ')
  return label.length > 12 && space > 0 ? [label.slice(0, space), label.slice(space + 1)] : [label]
}

const summary = (axes: Skill[], series: RadarSeries) =>
  `${series.label}: ${axes.map((axis) => `${axis.label} ${fmt(series.values[axis.key])}`).join(', ')}`

/**
 * Örümcek ağı: 1-10 puan, son (dolu) ve bir önceki (kesikli) üst üste.
 * Ekran okuyucu için aria-label özeti; altında aynı sayılar tablo olarak.
 */
export function RadarChart({
  title,
  axes,
  current,
  previous,
}: {
  title: string
  axes: Skill[]
  current: RadarSeries
  previous?: RadarSeries
}) {
  const count = axes.length
  const label = [title, summary(axes, current), previous && summary(axes, previous)].filter(Boolean).join('. ')
  return (
    <figure className="space-y-2">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mx-auto block h-auto w-full max-w-[400px] overflow-visible"
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, index) => point(index, count, ring).join(',')).join(' ')}
            fill="none"
            stroke="var(--line)"
            strokeWidth={ring === MAX ? 1.5 : 1}
          />
        ))}
        {axes.map((axis, index) => {
          const [x, y] = point(index, count, MAX)
          const [lx, ly] = point(index, count, MAX * 1.18)
          const anchor = Math.abs(lx - CX) < 4 ? 'middle' : lx > CX ? 'start' : 'end'
          const parts = lines(axis.label)
          return (
            <g key={axis.key}>
              <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--line)" />
              <text
                x={lx}
                y={ly - ((parts.length - 1) * 12) / 2}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={12}
                fill="var(--ink)"
              >
                {parts.map((part, row) => (
                  <tspan key={row} x={lx} dy={row === 0 ? 0 : 12}>
                    {part}
                  </tspan>
                ))}
              </text>
            </g>
          )
        })}
        {previous && (
          <polygon
            points={polygon(axes, previous.values)}
            fill="none"
            stroke="var(--ink)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
        <polygon
          points={polygon(axes, current.values)}
          fill="var(--accent)"
          fillOpacity={0.22}
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {axes.map((axis, index) => {
          const value = current.values[axis.key]
          if (value === undefined) return null
          const [x, y] = point(index, count, value)
          return <circle key={axis.key} cx={x} cy={y} r={3} fill="var(--accent)" />
        })}
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-5" style={{ background: 'var(--accent)' }} />
          {current.label}
        </span>
        {previous && (
          <span className="flex items-center gap-1.5 opacity-75">
            <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: 'var(--ink)' }} />
            {previous.label}
          </span>
        )}
      </figcaption>
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="text-left text-xs opacity-75">
            <th scope="col" className="py-1 font-medium">Yetenek</th>
            <th scope="col" className="py-1 text-right font-medium">{current.label}</th>
            {previous && <th scope="col" className="py-1 text-right font-medium">{previous.label}</th>}
          </tr>
        </thead>
        <tbody>
          {axes.map((axis) => (
            <tr key={axis.key} className="border-t border-line">
              <th scope="row" className="py-1 text-left font-normal">{axis.label}</th>
              <td className="py-1 text-right font-bold tabular-nums">{fmt(current.values[axis.key])}</td>
              {previous && <td className="py-1 text-right tabular-nums opacity-75">{fmt(previous.values[axis.key])}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
