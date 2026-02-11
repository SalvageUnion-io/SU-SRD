import { cn } from '../../utils/cn'

type HeatBarProps = {
  current: number
  capacity: number
  compact?: boolean
}

function getHeatSeverity(current: number, capacity: number) {
  if (capacity <= 0) return { label: 'N/A', colorClass: 'bg-su-grey', textClass: 'text-su-grey' }
  const ratio = current / capacity
  if (ratio >= 1) return { label: 'AT CAP', colorClass: 'bg-heat-cap', textClass: 'text-heat-cap' }
  if (ratio >= 0.75)
    return { label: 'CRITICAL', colorClass: 'bg-heat-critical', textClass: 'text-heat-critical' }
  if (ratio >= 0.5)
    return { label: 'RISING', colorClass: 'bg-heat-rising', textClass: 'text-heat-rising' }
  return { label: 'LOW', colorClass: 'bg-heat-low', textClass: 'text-heat-low' }
}

export function HeatBar({ current, capacity, compact = false }: HeatBarProps) {
  const { label, colorClass, textClass } = getHeatSeverity(current, capacity)
  const pct = capacity > 0 ? Math.min((current / capacity) * 100, 100) : 0

  return (
    <div className={cn('flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <span className={cn('font-bold', textClass)}>HT</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-su-grey-light/40">
        <div
          className={cn('h-full rounded-full transition-all duration-300', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums">
        {current}/{capacity}
      </span>
      {!compact && (
        <span className={cn('text-[10px] font-bold uppercase', textClass)}>{label}</span>
      )}
    </div>
  )
}
