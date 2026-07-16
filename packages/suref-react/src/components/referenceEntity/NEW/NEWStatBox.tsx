import { cn } from '../../../utils/cn'
import { StatDisplay } from '../../shared/StatDisplay'
import type { StatItem } from '../../shared/statsBarTypes'

type NEWStatBoxProps = {
  /** Headline stats (already capped to 1–3 by the caller). Each renders as a
   * centred StatDisplay value box (the "axis" cluster, top-right of the header). */
  /** Every header stat — the cluster wraps to multiple rows when needed. */
  stats: StatItem[]
  /** The atom has exactly TWO modes: NORMAL (vertical value boxes) and COMPACT.
   * COMPACT *is* the horizontal `[label | value]` cell layout — there is no
   * separate "horizontal" axis. */
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

  // ATOM MODEL: COMPACT header stats lay out as (at most) TWO rows — columns =
  // ceil(count/2), so 8 stats → 2 rows of 4, 6 → 2 rows of 3, etc. The cells flow
  // row-wise (reading order) and right-align. NORMAL vertical boxes flex-wrap and
  // right-align. Same inter-cell gap (gap-1) at both sizes.
  const cols = Math.max(1, Math.ceil(stats.length / 2))

  return (
    <div
      className={cn(
        'shrink-0 gap-1',
        compact
          ? 'grid w-fit justify-items-end justify-self-end'
          : 'flex flex-wrap items-start justify-end'
      )}
      style={compact ? { gridTemplateColumns: `repeat(${cols}, max-content)` } : undefined}
    >
      {stats.map((stat) => {
        const editMode = (stat.canEdit ?? true) ? 'edit' : 'read'
        // COMPACT — the horizontal shortform cell; an editable stat grows the
        // horizontal +/- stepper column (the "compact stat with steppers").
        if (compact) {
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
        // NORMAL — the vertical value box; editable grows the box's stepper column.
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
            onChange={stat.onChange}
          />
        ) : (
          <StatDisplay
            key={stat.key}
            label={stat.label}
            value={stat.value}
            bottomLabel={stat.bottomLabel}
            hoverText={stat.hoverText}
          />
        )
      })}
    </div>
  )
}
