import { Minus, Plus } from 'lucide-react'
import { cn } from '../../utils/cn'

type ResourceStepperProps = {
  label: string
  current: number
  max?: number
  onChange: (value: number) => void
  colorClass?: string
  min?: number
}

export function ResourceStepper({
  label,
  current,
  max,
  onChange,
  colorClass = 'text-pilot',
  min = 0,
}: ResourceStepperProps) {
  const ceiling = max ?? Infinity

  return (
    <div className="flex items-center gap-1">
      <span className={cn('mr-1 text-xs font-bold', colorClass)}>{label}</span>
      <button
        onClick={() => onChange(Math.max(min, current - 1))}
        disabled={current <= min}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] transition-colors hover:bg-su-grey-light/20 disabled:opacity-30"
        aria-label={`Decrease ${label}`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[3ch] text-center text-sm font-bold tabular-nums">
        {current}
        {max !== undefined && <span className="text-su-grey">/{max}</span>}
      </span>
      <button
        onClick={() => onChange(Math.min(ceiling, current + 1))}
        disabled={current >= ceiling}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] transition-colors hover:bg-su-grey-light/20 disabled:opacity-30"
        aria-label={`Increase ${label}`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
