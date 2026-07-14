import { StatDisplay } from './StatDisplay'
import { cn } from '../../utils/cn'
import type { StatItem } from './statsBarTypes'

type StatsBarProps = {
  stats: StatItem[]
  compact?: boolean
  suppressTooltips?: boolean
  className?: string
}

export function StatsBar({
  stats,
  compact = false,
  suppressTooltips = false,
  className,
}: StatsBarProps) {
  return (
    <div className={cn('flex items-center', compact ? 'gap-0.5' : 'gap-0.5', className)}>
      {stats.map((stat) => {
        if (stat.value === undefined) return null

        if (stat.onChange) {
          return (
            <StatDisplay
              key={stat.key}
              label={stat.label}
              value={typeof stat.value === 'number' ? stat.value : parseInt(String(stat.value), 10)}
              max={stat.outOfMax}
              bottomLabel={stat.bottomLabel}
              mode={(stat.canEdit ?? true) ? 'edit' : 'read'}
              compact={compact}
              onChange={stat.onChange}
            />
          )
        }

        return (
          <StatDisplay
            key={stat.key}
            label={stat.label}
            value={stat.value}
            max={stat.outOfMax}
            bottomLabel={stat.bottomLabel}
            hoverText={suppressTooltips ? undefined : stat.hoverText}
            inverse={stat.inverse}
            bg={stat.bg}
            valueColor={stat.valueColor}
            borderColor={stat.borderColor}
            isOverMax={stat.isOverMax}
            flash={stat.flash}
            disabled={stat.disabled}
            ariaLabel={stat.ariaLabel}
            compact={compact}
            onClick={stat.onClick}
          />
        )
      })}
    </div>
  )
}
