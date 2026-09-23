/** "Aidat gecikmiş" rozeti — yalnız bilgi, tutar/detay yok. */
export function DuesBadge({ id }: { id?: string }) {
  return (
    <span
      id={id}
      role="img"
      aria-label="Aidat gecikmiş"
      className="shrink-0 rounded-full bg-dues-soft px-2 py-0.5 text-[11px] font-bold text-dues"
    >
      Aidat
    </span>
  )
}
