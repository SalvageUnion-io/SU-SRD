import type { Size } from '../../../styles/sizing'
import { Stat } from '../../atoms/Stat'
import type { StatItem } from '../../containers/statsBarTypes'

/**
 * FACTS — the body's first cells: each a horizontal `Stat` at its `full`
 * rung, the row's content. An editable stat (a sheet's override) grows its
 * stepper, exactly as the card's cluster does. A catalog Tile sets its cells a
 * rung down (`compact`), under the art. A value longer than the row is wide (a
 * hybrid class's requirements in a tile) wraps onto more lines instead of
 * being clipped by the frame (`wrap`).
 */
export function Facts({ cells, size = 'full' }: { cells: StatItem[]; size?: Size }) {
  return (
    <>
      {cells.map((stat) => (
        <Stat
          key={stat.key}
          label={stat.label}
          value={stat.value}
          bottomLabel={stat.bottomLabel}
          size={size}
          state={stat.state}
          onChange={stat.onChange}
          mode={stat.onChange ? ((stat.canEdit ?? true) ? 'edit' : 'read') : 'read'}
          max={stat.outOfMax}
          hoverText={stat.hoverText}
          wrap
        />
      ))}
    </>
  )
}
