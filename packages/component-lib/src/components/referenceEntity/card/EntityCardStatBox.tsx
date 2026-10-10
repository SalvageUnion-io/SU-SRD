import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'

type EntityCardStatBoxProps = {
  /** Every header stat, in order. */
  stats: StatItem[]
  /**
   * A one-line head row (ruleset §1 Listing): the cells hold ONE row and the
   * name keeps its full width, so a cell that does not fit is dropped, last
   * (lowest priority) first, rather than crushing the title to "L…". Cells wrap
   * onto a second row that the clip hides.
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
