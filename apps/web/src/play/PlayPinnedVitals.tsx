/**
 * PlayPinnedVitals — the live vitals pinned above every pane below `lg`
 * (play.md §11, `pinnedUnits`): what a spend reads, in reach whichever pane
 * is open, with its − / + while the unit is live, so damage lands without a
 * tab switch. From `lg` the Units column holds them, so nothing is pinned.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { CSSVarStyle } from '../components/index'
import { Box, capsLabel, heatDangerFrom, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayVital } from './PlayVital'
import type { PinnedUnit } from './playPanes.model'
import { tableUnits } from './tableMode.model'

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
 * A live unit's vitals take their − / + and write the field the Units pane
 * writes (`tableUnits`); a unit that isn't live is a read-out. Nothing in
 * Downtime.
 */
export function PlayPinnedVitals({
  units,
  live,
  onWrite,
}: {
  units: readonly PinnedUnit[]
  /** Which units take writes (`usePlayUnits().live`). */
  live: Record<PinnedUnit['kind'], boolean>
  /** The Units pane's write: the unit, the record field, the clamped value. */
  onWrite: (kind: PinnedUnit['kind'], field: string, next: number) => void
}) {
  if (units.length === 0) return null
  return (
    <section aria-label={playCopy('pinnedVitals')} style={UNITS}>
      {tableUnits(units).map((unit) => (
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
                  onChange={
                    live[unit.kind] ? (next) => onWrite(unit.kind, v.field, next) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </Box>
      ))}
    </section>
  )
}

/** MOCK: the opened vital's line, its − / + at the phone's 44px (`.su-play-pins__pad`). */
const PAD = { padding: `${tokens.space[6]} ${tokens.space[8]}` } satisfies CSSProperties

/**
 * MOCK (Working Manual E): the phone's pinned vitals as ONE row of framed
 * numbers, the pilot's HP and AP then the mech's SP, EP and Heat, each the
 * compact `VitalGauge` read-out (`PlayVital`) in a frame of its unit's tone.
 * Tapping one opens its − / + under the row (one at a time), so five vitals
 * take one line of the screen until a number has to change.
 */
export function PlayPinnedStrip({
  units,
  live,
  onWrite,
  initialOpen = null,
}: {
  units: readonly PinnedUnit[]
  live: Record<PinnedUnit['kind'], boolean>
  onWrite: (kind: PinnedUnit['kind'], field: string, next: number, label: string) => void
  /** The vital open at first, by its label. */
  initialOpen?: string | null
}) {
  const [open, setOpen] = useState<string | null>(initialOpen)
  if (units.length === 0) return null
  const cells = tableUnits(units).flatMap((unit) => unit.vitals.map((v) => ({ unit, v })))
  const picked = cells.find(({ v, unit }) => v.label === open && live[unit.kind])
  const danger = (v: { label: string; max: number }) =>
    v.label === 'Heat' && v.max > 0 ? heatDangerFrom(v.max) : undefined
  return (
    <section aria-label={playCopy('pinnedVitals')} className="su-play-pins">
      <ul className="su-play-pins__row">
        {cells.map(({ unit, v }) => (
          <li key={v.label}>
            <button
              type="button"
              className="su-play-pin"
              style={{ '--pin': `var(--color-${unit.kind})` } as CSSVarStyle}
              aria-expanded={picked?.v.label === v.label}
              aria-label={`${unit.name} ${v.label} ${v.value} of ${v.max}. Change`}
              disabled={!live[unit.kind]}
              onClick={() => setOpen(open === v.label ? null : v.label)}
            >
              <PlayVital
                label={v.label}
                value={v.value}
                max={v.max}
                tone={unit.kind}
                danger={danger(v)}
              />
            </button>
          </li>
        ))}
      </ul>
      {picked ? (
        <div className="su-play-pins__pad">
          <Box frameColor={`var(--color-${picked.unit.kind})`} body="flush" bodyStyle={PAD}>
            <PlayVital
              label={`${picked.unit.name} · ${picked.v.label}`}
              value={picked.v.value}
              max={picked.v.max}
              tone={picked.unit.kind}
              danger={danger(picked.v)}
              onChange={(next) => onWrite(picked.unit.kind, picked.v.field, next, picked.v.label)}
            />
          </Box>
        </div>
      ) : null}
    </section>
  )
}
