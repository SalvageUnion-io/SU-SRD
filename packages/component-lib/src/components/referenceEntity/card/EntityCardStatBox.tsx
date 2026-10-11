import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'

type EntityCardStatBoxProps = {
  /** Every header stat, in order. */
  stats: StatItem[]
  /**
   * A one-line head row (ruleset §1 Listing): the cells hold ONE row in the
   * room the full name leaves them, and a cell that does not fit is dropped,
   * last (lowest priority) first — every cell goes before the name truncates.
   * A dropped cell wraps onto a second row that the clip hides.
   */
  oneRow?: boolean
}

/** One compact cell's height: the clip for a one-row cluster. */
const CELL_ROW = '1.125rem'

const cluster = (oneRow: boolean): CSSProperties => ({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[4],
  justifyContent: 'flex-end',
  minWidth: 0,
  ...(oneRow ? { maxHeight: CELL_ROW, overflow: 'hidden' } : {}),
})

/**
 * The first item of a one-row cluster: no width, one cell tall. A wrapping row
 * always keeps its first item, so without it a first cell too wide for the
 * room would stay on the visible row and be cut; behind it, that cell wraps
 * onto the hidden row like the rest.
 */
const ROW_ANCHOR: CSSProperties = { flex: 'none', height: CELL_ROW, width: 0 }

/**
 * EntityCardStatBox — the header's value cells (board E1): each stat is the
 * framed `[label | value]` cell — a real horizontal `Stat`, so the value-cell
 * law (ruleset §7.1) holds — clustered after the title. One anatomy at every
 * size: the vertical value boxes the large card used to wear are gone, which
 * also retired the header's width measurement (the cells wrap instead).
 *
 * An editable stat grows the horizontal stepper (the sheet's stat overrides).
 */
export function EntityCardStatBox({ stats, oneRow = false }: EntityCardStatBoxProps) {
  if (stats.length === 0) return null
  return (
    <div style={cluster(oneRow)}>
      {oneRow && <span aria-hidden="true" style={ROW_ANCHOR} />}
      {stats.map((stat) => (
        <Stat
          key={stat.key}
          orientation="horizontal"
          label={stat.label}
          value={stat.value}
          bottomLabel={stat.bottomLabel}
          size="compact"
          state={stat.state}
          onChange={stat.onChange}
          mode={stat.onChange ? ((stat.canEdit ?? true) ? 'edit' : 'read') : 'read'}
          max={stat.outOfMax}
          hoverText={stat.hoverText}
        />
      ))}
    </div>
  )
}
