/**
 * BandStats — a slot's counted readouts as label-first chips (`HEAT | 3/6`,
 * `POOL | 3/10`): the horizontal `Stat`, as every count reads. A Minor, a
 * canvas bay and a phone bay all draw them; text that is not a count stays a
 * line.
 */

import type { CSSProperties } from 'react'
import { space } from '../../../ui/design/tokens'
import { Stat } from '../../../ui/index'

/** One counted readout: its label, its value, and the cap it reads against. */
export type BandStat = { label: string; value: number | string; max?: number }

const ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
} satisfies CSSProperties

export function BandStats({ stats }: { stats: BandStat[] }) {
  if (stats.length === 0) return null
  return (
    <span style={ROW}>
      {stats.map((s) => (
        <Stat
          key={s.label}
          orientation="horizontal"
          size="compact"
          label={s.label}
          value={s.value}
          max={s.max}
        />
      ))}
    </span>
  )
}
