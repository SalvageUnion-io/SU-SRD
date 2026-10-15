/**
 * PinnedVitals — the phone form's pinned row (ADR-045 D8): the numbers a
 * spend reads, as label | value cells (`Stat`, ruleset §3.7 and §7.1), with no
 * gauge track.
 *
 * Two places only: the resolve screen's header (Heat while boarded, plus the
 * action's currency), and under the unit tabs on every tab that is not the
 * Major's. On the Major's own tab its full cells lead the tab, so nothing is
 * pinned there, and in Downtime nothing spends.
 */

import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { Stat } from '../index'

export type PinnedVital = { label: string; value: number; max: number }

const ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
  margin: 0,
  padding: 0,
  listStyle: 'none',
} satisfies CSSProperties

export function PinnedVitals({ vitals }: { vitals: PinnedVital[] }) {
  if (vitals.length === 0) return null
  return (
    <ul aria-label="Pinned vitals" style={ROW}>
      {vitals.map((v) => (
        <li key={v.label}>
          <Stat
            orientation="horizontal"
            size="compact"
            label={v.label}
            value={v.value}
            max={v.max}
          />
        </li>
      ))}
    </ul>
  )
}
