import { cn } from '../../utils/cn'

type FilterChipProps = {
  label: string
  active: boolean
  onClick: () => void
  colorClass?: string
  /** Optional inline CSS background value for a small color swatch (e.g. TL chips).
   *  When provided the chip renders a 14×14 px bordered swatch before the label
   *  and switches to font-cond for the label text (.tlchip treatment). */
  swatchStyle?: string
}

export function FilterChip({ label, active, onClick, colorClass, swatchStyle }: FilterChipProps) {
  const base =
    'cursor-pointer rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase transition-colors'

  // When a swatch is shown, use tlchip layout: flex row, font-cond label, bordered swatch
  const swatchBase =
    'cursor-pointer flex items-center gap-1.5 rounded border border-su-black px-2.5 py-1 font-cond text-[13px] font-semibold uppercase tracking-[.04em] transition-colors'

  let classes: string
  if (swatchStyle !== undefined) {
    // tlchip mode
    classes = active
      ? cn(swatchBase, 'bg-su-black text-su-white')
      : cn(
          swatchBase,
          'bg-su-white text-su-black hover:bg-su-grey-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'
        )
  } else if (active) {
    classes = colorClass ? cn(base, colorClass) : cn(base, 'bg-su-black text-su-white')
  } else {
    // Inactive state uses fully opaque text-su-black on bg-su-grey-light so contrast
    // passes WCAG AA (≥ 4.5:1 for normal text).
    // - text-su-black (rgb(40,32,25)) on bg-su-grey-light (rgb(199,199,199)) ≈ 9.1:1
    // - text-su-black on white (colorClass variant) = 16:1
    classes = colorClass
      ? cn(
          base,
          'text-su-black hover:bg-su-grey-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'
        )
      : cn(
          base,
          'bg-su-grey-light text-su-black hover:bg-su-grey-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'
        )
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={classes}>
      {swatchStyle !== undefined && (
        <i
          aria-hidden="true"
          className="block h-3.5 w-3.5 shrink-0 rounded-sm border border-su-black"
          style={{ background: swatchStyle }}
        />
      )}
      {label}
    </button>
  )
}
