import { cn } from '../../../utils/cn'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'

type EntityCardStatBoxProps = {
  /** Headline stats (already capped to 1–3 by the caller). Each renders as a
   * centred Stat value box (the "axis" cluster, top-right of the header). */
  /** Every header stat — the cluster wraps to multiple rows when needed. */
  stats: StatItem[]
  /** The atom has exactly TWO modes: NORMAL (vertical value boxes) and COMPACT.
   * COMPACT *is* the horizontal `[label | value]` cell layout — there is no
   * separate "horizontal" axis. */
  compact?: boolean
}

/**
 * EntityCardStatBox — the header's top-right headline-stat cluster.
 *
 * Deliberately a thin layout shell: each stat is a real `Stat` value box
 * (the canonical stat/value primitive), just clustered and right-aligned. No
 * ad-hoc stat rendering happens here — this is composition, not a new atom.
 */
export function EntityCardStatBox({ stats, compact = false }: EntityCardStatBoxProps) {
  if (stats.length === 0) return null

  // COMPACT header stats FLOW naturally — a left-aligned flex-wrap row that packs
  // cells left-to-right and wraps only when it runs out of width (no rigid grid
  // columns, so varying label widths never leave alignment gaps). The compact
  // cluster sits full-width below the title, so it fills toward the RIGHT as it
  // flows. NORMAL vertical boxes flex-wrap and right-align in the header row.

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1',
        compact ? 'w-full items-center justify-start' : 'shrink-0 items-start justify-end'
      )}
    >
      {stats.map((stat) => {
        const editMode = (stat.canEdit ?? true) ? 'edit' : 'read'
        // COMPACT — the horizontal shortform cell; an editable stat grows the
        // horizontal +/- stepper column (the "compact stat with steppers").
        if (compact) {
          return (
            <Stat
              key={stat.key}
              orientation="horizontal"
              label={stat.label}
              value={stat.value}
              bottomLabel={stat.bottomLabel}
              compact
              state={stat.state}
              onChange={stat.onChange}
              mode={stat.onChange ? editMode : 'read'}
              max={stat.outOfMax}
            />
          )
        }
        // NORMAL — the vertical value box; editable grows the box's stepper column.
        return stat.onChange ? (
          <Stat
            key={stat.key}
            label={stat.label}
            value={
              typeof stat.value === 'number' ? stat.value : Number.parseInt(String(stat.value), 10)
            }
            max={stat.outOfMax}
            bottomLabel={stat.bottomLabel}
            state={stat.state}
            mode={editMode}
            onChange={stat.onChange}
          />
        ) : (
          <Stat
            key={stat.key}
            label={stat.label}
            value={stat.value}
            bottomLabel={stat.bottomLabel}
            state={stat.state}
            hoverText={stat.hoverText}
          />
        )
      })}
    </div>
  )
}
