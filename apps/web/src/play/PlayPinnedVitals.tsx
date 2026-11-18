/**
 * PlayPinnedVitals — the live vitals pinned above every pane below `lg`
 * (play.md §11, `pinnedUnits`): what a spend reads, in reach whichever pane
 * is open, with its − / + while the unit is live, so damage lands without a
 * tab switch. From `lg` the Units column holds them, so nothing is pinned.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { CSSVarStyle } from '../components/index'
import { Box, capsLabel, heatDangerFrom, PhoneVitals, tokens } from '../components/index'
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

/** Each vital's words in full, for assistive tech (`PhoneVitals`' `name`). */
const VITAL_NAME: Record<string, string> = {
  HP: 'Hit Points',
  AP: 'Ability Points',
  SP: 'Structure Points',
  EP: 'Energy Points',
  Heat: 'Heat',
}

/**
 * MOCK (Working Manual wave 2, phone vitals): the phone's pinned vitals in the
 * sheets' phone idiom (`PhoneVitals`, the owner's phone-vitals ruling): ONE
 * quiet card of five cells, the pilot's HP and AP then the mech's SP, EP and
 * Heat, each a short label, the value over its max in plain numerals and a
 * slim meter in its unit's colour. Tapping a cell opens that unit's
 * `PhoneVitals` block under the strip (its rows with their − | + at 44px,
 * the tapped one marked), so the five take one 52px line of the screen until
 * a number has to change. A second tap closes it.
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
  const tone = (kind: PinnedUnit['kind']) => ({ '--tone': `var(--color-${kind})` }) as CSSVarStyle
  return (
    <section aria-label={playCopy('pinnedVitals')} className="su-play-pins">
      <ul className="su-play-pins__row">
        {cells.map(({ unit, v }) => {
          const redline = danger(v)
          const hot = redline !== undefined && v.value > redline
          return (
            <li key={v.label}>
              <button
                type="button"
                className="su-play-pin"
                style={tone(unit.kind)}
                aria-expanded={picked?.v.label === v.label}
                aria-label={`${unit.name} ${v.label} ${v.value} of ${v.max}. Change`}
                disabled={!live[unit.kind]}
                data-hot={hot || undefined}
                onClick={() => setOpen(open === v.label ? null : v.label)}
              >
                <span className="su-play-pin__label">{v.label}</span>
                <span className="su-play-pin__value">
                  <b>{v.value}</b>
                  <i>/{v.max}</i>
                </span>
                <span className="su-play-pin__meter" aria-hidden="true">
                  <span
                    style={{ width: `${v.max > 0 ? Math.min(100, (v.value / v.max) * 100) : 0}%` }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {picked ? (
        <PhoneVitals
          label={playCopy('sVitals', { name: picked.unit.name })}
          className="su-play-pins__pad"
          style={tone(picked.unit.kind)}
          vitals={picked.unit.vitals.map((v) => ({
            key: v.label.toLowerCase(),
            label: v.label,
            name: `${picked.unit.name} ${VITAL_NAME[v.label] ?? v.label}`,
            value: v.value,
            max: v.max,
            ...(danger(v) !== undefined ? { danger: danger(v) } : {}),
            onChange: (next: number) => onWrite(picked.unit.kind, v.field, next, v.label),
          }))}
        />
      ) : null}
    </section>
  )
}
