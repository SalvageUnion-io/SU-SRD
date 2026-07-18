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
  // On the shared chrome token system (ink / paper / rust), matching
  // Button / Sel / StepButton — active = ink fill, inactive = paper.
  const base =
    'cursor-pointer rounded-badge px-2 py-0.5 font-mono text-xs font-semibold uppercase transition-colors'

  // When a swatch is shown, use tlchip layout: flex row, font-cond label, bordered swatch
  const swatchBase =
    'cursor-pointer flex items-center gap-1.5 rounded-badge border border-ink px-2.5 py-1 font-cond text-caption font-semibold uppercase tracking-caps-tight transition-colors'

  // The shared themed keyboard-focus ring (WCAG 2.4.7) — rust, matching every
  // other chrome control.
  const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25'

  let classes: string
  if (swatchStyle !== undefined) {
    // tlchip mode
    classes = active
      ? cn(swatchBase, 'bg-ink text-paper', focusRing)
      : cn(swatchBase, 'bg-paper text-ink hover:bg-wk-bg-2', focusRing)
  } else if (active) {
    classes = colorClass
      ? cn(base, colorClass, focusRing)
      : cn(base, 'bg-ink text-paper', focusRing)
  } else {
    // Inactive = ink text on paper (high contrast, WCAG AA); hover deepens to wk-bg-2.
    classes = colorClass
      ? cn(base, 'text-ink hover:bg-wk-bg-2', focusRing)
      : cn(base, 'bg-paper text-ink hover:bg-wk-bg-2', focusRing)
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={classes}>
      {swatchStyle !== undefined && (
        <i
          aria-hidden="true"
          className="block h-3.5 w-3.5 shrink-0 rounded-pip border border-ink"
          style={{ background: swatchStyle }}
        />
      )}
      {label}
    </button>
  )
}
