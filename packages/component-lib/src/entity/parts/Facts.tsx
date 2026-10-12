import { Stat } from '../../components/shared/Stat'
import type { StatItem } from '../../components/shared/statsBarTypes'

/**
 * FACTS — the body's first cells: each a horizontal `Stat` at its `full`
 * rung, the row's content. An editable stat (a sheet's override) grows its
 * stepper, exactly as the card's cluster does.
 */
export function Facts({ cells }: { cells: StatItem[] }) {
  return (
    <>
      {cells.map((stat) => (
        <Stat
          key={stat.key}
          orientation="horizontal"
          label={stat.label}
          value={stat.value}
          bottomLabel={stat.bottomLabel}
          size="full"
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
