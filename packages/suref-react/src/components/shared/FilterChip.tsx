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
    classes = colorClass
      ? cn(base, 'text-su-grey-dark hover:text-su-black hover:bg-su-grey-light/30')
      : cn(
          base,
          'bg-su-grey-light/30 text-su-grey-dark hover:text-su-black hover:bg-su-grey-light/50'
        )
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={classes}>
      {label}
    </button>
  )
}
