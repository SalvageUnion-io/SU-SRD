import { StatDisplay } from '../../shared/StatDisplay'
import type { StatItem } from '../../shared/statsBarTypes'

type NEWStatBoxProps = {
  /** Headline stats (already capped to 1–3 by the caller). Each renders as a
   * centred StatDisplay value box (the "axis" cluster, top-right of the header). */
  /** Every header stat — the cluster wraps to multiple rows when needed. */
  stats: StatItem[]
  compact?: boolean
  /** Listing mode: render the stats as horizontal `[label | value]` cells
   * (wrapping to up to ~2 rows), not the vertical value boxes. */
  horizontal?: boolean
}

/**
 * NEWStatBox — the header's top-right headline-stat cluster.
 *
 * Deliberately a thin layout shell: each stat is a real `StatDisplay` value box
 * (the canonical stat/value primitive), just clustered and right-aligned. No
 * ad-hoc stat rendering happens here — this is composition, not a new atom.
 */
export function NEWStatBox({ stats, compact = false, horizontal = false }: NEWStatBoxProps) {
  if (stats.length === 0) return null

  return (
    <div
      // Same inter-box gap (gap-1) at every size, and no extra compact shrink —
      // compact boxes render a notch bigger and their spacing equals full mode.
      className="flex shrink-0 flex-wrap items-start justify-end gap-1"
    >
      {stats.map((stat) =>
        horizontal ? (
          <StatDisplay
            key={stat.key}
            orientation="horizontal"
            label={stat.label}
            value={stat.value}
            bottomLabel={stat.bottomLabel}
            compact
          />
        ) : (
          <StatDisplay
            key={stat.key}
            label={stat.label}
            value={stat.value}
            bottomLabel={stat.bottomLabel}
            hoverText={stat.hoverText}
            compact={compact}
          />
        )
      )}
    </div>
  )
}
