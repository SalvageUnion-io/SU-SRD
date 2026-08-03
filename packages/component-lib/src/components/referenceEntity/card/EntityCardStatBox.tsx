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
/** Split a compact cluster past this many cells into two balanced, right-aligned
 * rows (rather than one long line). 8 drone stats → 4 + 4. */
const COMPACT_ROW_CAP = 4

export function EntityCardStatBox({ stats, compact = false }: EntityCardStatBoxProps) {
  if (stats.length === 0) return null

  const renderStat = (stat: StatItem) => {
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
          size="compact"
          state={stat.state}
          onChange={stat.onChange}
          mode={stat.onChange ? editMode : 'read'}
          max={stat.outOfMax}
          hoverText={stat.hoverText}
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
        hoverText={stat.hoverText}
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
  }

  // COMPACT header stats are RIGHT-aligned horizontal cells. A long cluster
  // (> COMPACT_ROW_CAP) splits into two balanced rows so the header never runs
  // one very long line; each row still flex-wraps further on a narrow screen.
  if (compact) {
    if (stats.length > COMPACT_ROW_CAP) {
      const half = Math.ceil(stats.length / 2)
      const rows = [stats.slice(0, half), stats.slice(half)]
      return (
        <div className="flex w-full flex-col items-end gap-1">
          {rows.map((row) => (
            <div
              key={row.map((s) => s.key).join('|')}
              className="flex flex-wrap items-center justify-end gap-1"
            >
              {row.map(renderStat)}
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-1">
        {stats.map(renderStat)}
      </div>
    )
  }

  // NORMAL — vertical value boxes flex-wrap and right-align in the header row.
  //
  // No `shrink-0`: it held the cluster at its max-content width, which meant the
  // `flex-wrap` beside it could never engage (a flex item that cannot shrink
  // never reaches a width its children must wrap at). Eight chassis stats then
  // ran a 420px line off the side of a phone-width card, straight over the
  // breadcrumb. Shrinking lets the boxes wrap onto a second row instead — the
  // floor for every case the header's measurement declines to judge (an
  // unmeasurable band, no `ResizeObserver`). When it CAN measure, it swaps to
  // the compact cells rather than wrapping at all (see `useNarrowStats`).
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-end gap-1">
      {stats.map(renderStat)}
    </div>
  )
}
