import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'

type EntityCardStatBoxProps = {
  /** Every header stat, in order. */
  stats: StatItem[]
  /**
   * Whether the cluster may wrap onto further rows. A one-line head row never
   * wraps (ruleset §1 Listing): its title truncates instead.
   */
  wrap?: boolean
}

const cluster = (wrap: boolean): CSSProperties => ({
  alignItems: 'center',
  display: 'flex',
  flexWrap: wrap ? 'wrap' : 'nowrap',
  gap: space[4],
  minWidth: 0,
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
export function EntityCardStatBox({ stats, wrap = true }: EntityCardStatBoxProps) {
  if (stats.length === 0) return null
  return (
    <div style={cluster(wrap)}>
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
