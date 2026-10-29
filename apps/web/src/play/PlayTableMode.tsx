/**
 * PlayTableMode — a phone's one focused Play screen (play.md §11, table mode):
 * what the TABLE toggle beside the Situation switch swaps the tabs for,
 * while the screen stays awake (`useWakeLock`).
 *
 *  - **Roll the die**: one Full button, a d20 on the Core Mechanic
 *    (`TABLE_ROLL`), recorded through `recordPlayRoll` like every roll in Play,
 *    so it reaches the Feed, the Game's log and, per the Post toggle, Discord.
 *    The last roll reads under it, its figure and its band.
 *  - **The vitals**: the pinned units (`tableUnits`), each vital the Full
 *    `VitalGauge` with its − / + under the track, written through the field
 *    the Units column writes. Read-only units draw read-outs.
 *
 * In Downtime nothing is pinned, so the screen says the tabs hold the step.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { coreRollBand, coreRollBandLabel } from 'salvageunion-reference/rules'
import type { CSSVarStyle } from '../components/index'
import {
  Box,
  Button,
  capsLabel,
  EmptyState,
  heatDangerFrom,
  Toggle,
  tokens,
  VitalGauge,
} from '../components/index'
import { dieForTable } from '../lib/dice'
import { playCopy } from '../messages/play'
import { recordPlayRoll } from './playRolls.model'
import type { TableUnit } from './tableMode.model'
import { TABLE_ROLL } from './tableMode.model'
import { useTableMode } from './useTableMode'

const ROOT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** The roll and its result, a block of their own above the vitals. */
const ROLL_BLOCK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const ROLL = { width: '100%' } satisfies CSSProperties

const RESULT = {
  alignItems: 'baseline',
  display: 'flex',
  gap: tokens.space[8],
  justifyContent: 'center',
  margin: 0,
} satisfies CSSProperties

const RESULT_DIE = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.displayLg,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: tokens.weight.bold,
  lineHeight: 1,
} satisfies CSSProperties
const RESULT_BAND = capsLabel({ size: 'readout' })

const UNIT = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  padding: tokens.space[8],
} satisfies CSSProperties

const UNIT_NAME = {
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const UNIT_NAME_CAPS = capsLabel({ size: 'caption' })

/** Two gauges a line: a phone's width holds two Full gauges and their − / +. */
const GAUGES = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** The gauge's `--tone` pair per unit, as `PlayVital` sets it. */
const TONES: Record<TableUnit['kind'], CSSVarStyle> = {
  pilot: { '--tone': 'var(--color-pilot)', '--tone-deep': 'var(--color-sheet-pilot-deep)' },
  mech: { '--tone': 'var(--color-mech)', '--tone-deep': 'var(--color-sheet-mech-deep)' },
}

type LastRoll = { die: number; band: string }

export type PlayTableModeProps = {
  units: readonly TableUnit[]
  /** Which units may be written now (`usePlayUnits`' `live`). */
  live: Record<TableUnit['kind'], boolean>
  /** Write one vital: the unit, the record field, the next value (clamped). */
  onWrite: (kind: TableUnit['kind'], field: string, next: number) => void
  /** The die (a test injects its own); the Core Mechanic's by default. */
  rollDie?: () => Promise<number>
}

async function coreMechanicDie(): Promise<number> {
  return (await dieForTable(TABLE_ROLL))()
}

export function PlayTableMode({
  units,
  live,
  onWrite,
  rollDie = coreMechanicDie,
}: PlayTableModeProps) {
  const [last, setLast] = useState<LastRoll | null>(null)
  const [rolling, setRolling] = useState(false)

  const roll = async () => {
    setRolling(true)
    try {
      const die = await rollDie()
      const band = coreRollBandLabel(coreRollBand(die))
      recordPlayRoll({ tableName: TABLE_ROLL, rolls: [die], label: TABLE_ROLL, outcome: band })
      setLast({ die, band })
    } finally {
      setRolling(false)
    }
  }

  return (
    <section aria-label={playCopy('tableMode')} style={ROOT}>
      <div style={ROLL_BLOCK}>
        <Button variant="primary" size="full" style={ROLL} disabled={rolling} onClick={roll}>
          {playCopy('rollTheDie')}
        </Button>
        {last ? (
          <p
            style={RESULT}
            role="status"
            aria-label={playCopy('rolledBand', { die: last.die, band: last.band })}
          >
            <span style={RESULT_DIE}>{last.die}</span>
            <span className={RESULT_BAND}>{last.band}</span>
          </p>
        ) : null}
      </div>
      {units.length === 0 ? (
        <EmptyState variant="inline" body={playCopy('nothingToTrackInDowntime')} />
      ) : (
        <section aria-label={playCopy('vitals')} style={ROOT}>
          {units.map((unit) => (
            <Box
              key={unit.kind}
              frameColor={`var(--color-${unit.kind})`}
              body="flush"
              bodyStyle={UNIT}
            >
              <p className={UNIT_NAME_CAPS} style={UNIT_NAME}>
                {unit.name}
              </p>
              <ul aria-label={playCopy('unitVitals', { name: unit.name })} style={GAUGES}>
                {unit.vitals.map((v) => (
                  <li key={v.label}>
                    <VitalGauge
                      label={v.label}
                      value={v.value}
                      max={v.max}
                      danger={v.label === 'Heat' && v.max > 0 ? heatDangerFrom(v.max) : undefined}
                      readOnly={!live[unit.kind]}
                      onChange={
                        live[unit.kind] ? (next) => onWrite(unit.kind, v.field, next) : undefined
                      }
                      steppers={live[unit.kind]}
                      style={TONES[unit.kind]}
                    />
                  </li>
                ))}
              </ul>
            </Box>
          ))}
        </section>
      )}
    </section>
  )
}

/**
 * TABLE, beside the phone's Situation switch: table mode on or off, this
 * device's choice (`useTableMode`): a `Toggle`, the switch's Compact Size.
 */
export function TableModeToggle() {
  const [on, setOn] = useTableMode()
  return (
    <Toggle pressed={on} aria-label={playCopy('tableMode')} onClick={() => setOn(!on)}>
      {playCopy('table')}
    </Toggle>
  )
}
