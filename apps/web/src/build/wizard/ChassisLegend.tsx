/**
 * ChassisLegend — the line over the mech wizard's chassis cards that spells
 * out their figures (r6 F3): SV, SP, EP, SYS, MOD, HEAT and CARGO, each label
 * opening the glossary Peek the sheet's own labels open (`StatMeaning`). The
 * cards are radios, so their labels stay plain: a control inside a radio
 * could not be reached on its own.
 */

import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { StatMeaning } from '../../components/app'
import { Text, tokens } from '../../components/index'
import { CHASSIS_COLUMNS } from '../mech/chassisColumns.model'

/** A chassis column's key, and the sheet stat whose meaning it opens. */
const STAT_KEY: Readonly<Record<string, string>> = {
  sys: 'systemSlots',
  mod: 'moduleSlots',
  cargo: 'cargoCapacity',
}

const LINE = { margin: `0 0 ${tokens.space[12]}` } satisfies CSSProperties

export function ChassisLegend() {
  return (
    <Text variant="hint" style={LINE}>
      {CHASSIS_COLUMNS.map((column, i) => (
        <Fragment key={column.key}>
          {i > 0 && ' · '}
          <StatMeaning statKey={STAT_KEY[column.key] ?? column.key}>{column.label}</StatMeaning>{' '}
          {column.title}
        </Fragment>
      ))}
    </Text>
  )
}
