import { cn } from '../../utils/cn'

type FilterChipProps = {
  label: string
  active: boolean
  onClick: () => void
  colorClass?: string
}

export function FilterChip({ label, active, onClick, colorClass }: FilterChipProps) {
  const base =
    'cursor-pointer rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase transition-colors'

  let classes: string
  if (active) {
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
      {label}
    </button>
  )
}
