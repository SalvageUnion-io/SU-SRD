/**
 * PlayPinnedVitals — the live vitals pinned above every pane below `lg`
 * (play.md §11, `pinnedUnits`): what a spend reads, in reach whichever pane
 * is open. From `lg` the Units column holds them, so nothing is pinned.
 */

import type { CSSProperties } from 'react'
import { capsLabel } from '../components/atoms/capsLabel'
import { Box, heatDangerFrom, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayVital } from './PlayVital'
import type { PinnedUnit } from './playPanes.model'

/** One unit a line: its gauges share it. */
const UNITS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const UNIT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
  minWidth: 0,
  padding: `${tokens.space[6]} ${tokens.space[8]}`,
} satisfies CSSProperties

const UNIT_NAME = {
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const UNIT_NAME_CAPS = capsLabel({ size: 'caption' })

const CELLS = {
  display: 'flex',
  gap: tokens.space[12],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** Each gauge an equal share of its unit's line. */
const CELL = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

/**
 * The pinned vitals (`pinnedUnits`): one line per unit,
 * its name, then its vitals as the Units column draws them (`PlayVital`, the
 * compact `VitalGauge`: R7, Play's vitals are the sheet's gauge in a darker
 * skin, never a listing's Stat), each unit's HP and AP in a box in its tone.
 * A read-out: the − / + are the Units pane's. Nothing in Downtime.
 */
export function PlayPinnedVitals({ units }: { units: readonly PinnedUnit[] }) {
  if (units.length === 0) return null
  return (
    <section aria-label={playCopy('pinnedVitals')} style={UNITS}>
      {units.map((unit) => (
        <Box key={unit.kind} frameColor={`var(--color-${unit.kind})`} body="flush" bodyStyle={UNIT}>
          <p className={UNIT_NAME_CAPS} style={UNIT_NAME}>
            {unit.name}
          </p>
          <ul aria-label={playCopy('sVitals', { name: unit.name })} style={CELLS}>
            {unit.vitals.map((v) => (
              <li key={v.label} style={CELL}>
                <PlayVital
                  label={v.label}
                  value={v.value}
                  max={v.max}
                  tone={unit.kind}
                  danger={v.label === 'Heat' && v.max > 0 ? heatDangerFrom(v.max) : undefined}
                />
              </li>
            ))}
          </ul>
        </Box>
      ))}
    </section>
  )
}
