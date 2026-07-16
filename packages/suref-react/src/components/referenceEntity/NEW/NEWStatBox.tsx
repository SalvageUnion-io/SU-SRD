import { cn } from '../../../utils/cn'
import { StatDisplay } from '../../shared/StatDisplay'
import type { StatItem } from '../../shared/statsBarTypes'

type NEWStatBoxProps = {
  /** Headline stats (already capped to 1–3 by the caller). Each renders as a
   * centred StatDisplay value box (the "axis" cluster, top-right of the header). */
  /** Every header stat — the cluster wraps to multiple rows when needed. */
  stats: StatItem[]
  compact?: boolean
}

/**
 * NEWStatBox — the header's top-right headline-stat cluster.
 *
 * Deliberately a thin layout shell: each stat is a real `StatDisplay` value box
 * (the canonical stat/value primitive), just clustered and right-aligned. No
 * ad-hoc stat rendering happens here — this is composition, not a new atom.
 */
export function NEWStatBox({ stats, compact = false }: NEWStatBoxProps) {
  if (stats.length === 0) return null

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-start justify-end gap-2',
        // Compact/nested cards shrink the whole stat cluster a notch below the
        // ValueBox's own compact size — the box has no smaller tier of its own.
        compact && 'origin-top-right scale-[0.85]'
      )}
    >
      {stats.map((stat) => (
        <StatDisplay
          key={stat.key}
          label={stat.label}
          value={stat.value}
          bottomLabel={stat.bottomLabel}
          hoverText={stat.hoverText}
          compact={compact}
        />
      ))}
    </div>
  )
}
