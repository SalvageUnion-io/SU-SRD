import { Stat } from '../../components/shared/Stat'
import type { StatItem } from '../../components/shared/statsBarTypes'
import type { SizeRung } from '../../styles/sizing'

/**
 * FACTS — the body's first cells: each a horizontal `Stat` at its `full`
 * rung, the row's content. An editable stat (a sheet's override) grows its
 * stepper, exactly as the card's cluster does. A catalog Tile sets its cells a
 * rung down (`compact`), under the art.
 */
export function Facts({ cells, size = 'full' }: { cells: StatItem[]; size?: SizeRung }) {
  return (
    <>
      {cells.map((stat) => (
        <Stat
          key={stat.key}
          orientation="horizontal"
          label={stat.label}
          value={stat.value}
          bottomLabel={stat.bottomLabel}
          size={size}
          state={stat.state}
          onChange={stat.onChange}
          mode={stat.onChange ? ((stat.canEdit ?? true) ? 'edit' : 'read') : 'read'}
          max={stat.outOfMax}
          hoverText={stat.hoverText}
        />
      ))}
    </>
  )
}
