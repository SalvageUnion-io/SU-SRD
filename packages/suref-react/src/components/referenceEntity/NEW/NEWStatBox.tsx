import { cn } from '../../../utils/cn'
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

  // ATOM MODEL: compact/horizontal header stats lay out as (at most) TWO rows —
  // columns = ceil(count/2), so 8 stats → 2 rows of 4, 6 → 2 rows of 3, etc. The
  // cells flow row-wise (reading order) and right-align. Full-size vertical boxes
  // flex-wrap and right-align. Same inter-cell gap (gap-1) at both sizes.
  const cols = Math.max(1, Math.ceil(stats.length / 2))

  return (
    <div
      className={cn(
        'shrink-0 gap-1',
        horizontal
          ? 'grid w-fit justify-items-end justify-self-end'
          : 'flex flex-wrap items-start justify-end'
      )}
      style={horizontal ? { gridTemplateColumns: `repeat(${cols}, max-content)` } : undefined}
    >
      {stats.map((stat) => {
        const editMode = (stat.canEdit ?? true) ? 'edit' : 'read'
        // COMPACT (horizontal) — the shortform cell; an editable stat grows the
        // horizontal +/- stepper column (the "compact stat with steppers").
        if (horizontal) {
          return (
            <StatDisplay
              key={stat.key}
              orientation="horizontal"
              label={stat.label}
              value={stat.value}
              bottomLabel={stat.bottomLabel}
              compact
              onChange={stat.onChange}
              mode={stat.onChange ? editMode : 'read'}
              max={stat.outOfMax}
            />
          )
        }
        // FULL — the vertical value box; editable grows the box's stepper column.
        return stat.onChange ? (
          <StatDisplay
            key={stat.key}
            label={stat.label}
            value={
              typeof stat.value === 'number' ? stat.value : Number.parseInt(String(stat.value), 10)
            }
            max={stat.outOfMax}
            bottomLabel={stat.bottomLabel}
            mode={editMode}
            compact={compact}
            onChange={stat.onChange}
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
      })}
    </div>
  )
}
