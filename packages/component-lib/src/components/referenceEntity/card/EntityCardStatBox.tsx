import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'

type EntityCardStatBoxProps = {
  /** Every header stat, in order. */
  stats: StatItem[]
  /**
   * A one-line head row (ruleset §1 Listing): the cells hold ONE row and the
   * name keeps its full width, so a cell that does not fit is dropped whole,
   * last (lowest priority) first, rather than crushing the title to "L…".
   * Cells wrap onto a second row that the clip hides.
   */
  oneRow?: boolean
  /**
   * One row only: the room kept before the first cell (the gap from the
   * title). It belongs to the first row, so it goes with the last cell.
   */
  lead?: string
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
  ...(oneRow ? { flex: '0 1 auto', maxHeight: CELL_ROW, overflow: 'hidden' } : {}),
})

/**
 * The first row's lead-in: a row-high spacer (with the gap cancelled) ahead of
 * the cells. The first cell must fit beside it or wrap onto the hidden row
 * too, so the clip never slices a cell; and the row keeps its height, so a
 * wrapped cell never rises into view.
 */
const leadIn = (lead: string): CSSProperties => ({
  flex: 'none',
  height: CELL_ROW,
  marginRight: `calc(-1 * ${space[4]})`,
  width: lead,
})

/**
 * EntityCardStatBox — the header's value cells (board E1): each stat is the
 * framed `[label | value]` cell — a real horizontal `Stat`, so the value-cell
 * law (ruleset §7.1) holds — clustered after the title. One anatomy at every
 * size: the vertical value boxes the large card used to wear are gone, which
 * also retired the header's width measurement (the cells wrap instead).
 *
 * An editable stat grows the horizontal stepper (the sheet's stat overrides).
 */
export function EntityCardStatBox({ stats, oneRow = false, lead = '0px' }: EntityCardStatBoxProps) {
  if (stats.length === 0) return null
  return (
    <div style={cluster(oneRow)}>
      {oneRow && <span aria-hidden="true" style={leadIn(lead)} />}
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
