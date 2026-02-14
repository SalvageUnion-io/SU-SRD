import { cn } from '../../utils/cn'

type ResourceBarProps = {
  current: number
  max: number
  label: string
  colorClass?: string
  compact?: boolean
}

export function ResourceBar({
  current,
  max,
  label,
  colorClass = 'bg-su-orange',
  compact = false,
}: ResourceBarProps) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0

  return (
    <div className={cn('flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <span className="font-medium text-su-grey-dark">{label}</span>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${current} of ${max}`}
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-su-grey-light/40"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-200', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums">
        {current}/{max}
      </span>
    </div>
  )
}
