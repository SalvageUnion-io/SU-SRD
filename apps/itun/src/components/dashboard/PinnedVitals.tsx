/**
 * PinnedVitals — the phone form's pinned row (ADR-044 D8): the numbers a
 * spend reads, as label | value cells (`Stat`, ruleset §3.7 and §7.1), with no
 * gauge track.
 *
 * Two places only: the resolve screen's header (Heat while boarded, plus the
 * action's currency), and under the unit tabs on every tab that is not the
 * Major's. On the Major's own tab its full cells lead the tab, so nothing is
 * pinned there, and in Downtime nothing spends.
 */

import { Stat } from 'component-lib'
import { space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

export type PinnedVital = { label: string; value: number; max: number }

const ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
  margin: 0,
  padding: 0,
  listStyle: 'none',
}

export function PinnedVitals({ vitals, label }: { vitals: PinnedVital[]; label: string }) {
  if (vitals.length === 0) return null
  return (
    <ul aria-label={label} style={ROW}>
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
