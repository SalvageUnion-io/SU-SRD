import { space } from '../../../design/tokens'
import type { SizeRung } from '../../../styles/sizing'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'

type EntityCardStatBoxProps = {
  /** Every stat, in order. */
  stats: StatItem[]
  /**
   * The cell rung: `compact` in a full card's header, `full` in the compact
   * card's body, where the values are the row's content (ruleset §2 Listing).
   */
  cellSize?: Extract<SizeRung, 'compact' | 'full'>
  /** Where the cells gather: after the title in a header (`end`), from the left in a body (`start`). */
  align?: 'start' | 'end'
}

/**
 * EntityCardStatBox — the card's value cells (board E1): each stat is the
 * framed `[label | value]` cell — a real horizontal `Stat`, so the value-cell
 * law (ruleset §7.1) holds. In a full card they cluster after the title; in
 * the compact card they lead its body. They wrap when the room runs out.
 *
 * An editable stat grows the horizontal stepper (the sheet's stat overrides).
 */
export function EntityCardStatBox({
  stats,
  cellSize = 'compact',
  align = 'end',
}: EntityCardStatBoxProps) {
  if (stats.length === 0) return null
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: space[4],
        justifyContent: align === 'start' ? 'flex-start' : 'flex-end',
        minWidth: 0,
      }}
    >
      {stats.map((stat) => (
        <Stat
          key={stat.key}
          orientation="horizontal"
          label={stat.label}
          value={stat.value}
          bottomLabel={stat.bottomLabel}
          size={cellSize}
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
