/**
 * A Dashboard bay's readings as label-first chips (`TL | 3`, the hull's Type),
 * shared by the canvas's `MajorFrame` and the phone's `PhoneMajorFrame`.
 */

import { Stat } from 'component-lib'
import type { CSSProperties } from 'react'
import type { BandStat } from './bayStats.model'

const STATS = { display: 'flex', flexWrap: 'wrap', gap: '4px' } satisfies CSSProperties

export function BayStats({ stats }: { stats: readonly BandStat[] }) {
  return (
    <div style={STATS}>
      {stats.map((st) => (
        <Stat
          key={st.label}
          label={st.label}
          value={st.value}
          orientation="horizontal"
          size="mini"
        />
      ))}
    </div>
  )
}
