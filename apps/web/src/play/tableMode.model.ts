/**
 * Table mode (play.md §11): a phone's one focused Play screen. The pinned
 * vitals at the Full Size with their − / +, and one big roll of the Core
 * Mechanic, in place of the tabs.
 *
 * A renderer, never a second home for play state (play.md §11): each vital is
 * the pinned one (`pinnedUnits`), written through the field the Units column
 * writes, and the roll goes through `recordPlayRoll` like every roll in Play.
 */

import type { PinnedUnit } from './playPanes.model'
import { CORE_MECHANIC_TABLE } from './tables.model'

/** The table every big roll is on. */
export const TABLE_ROLL = CORE_MECHANIC_TABLE

/** The record field each pinned vital writes, as `PlayUnits` writes it. */
const FIELD = {
  pilot: { HP: 'currentHP', AP: 'currentAP' },
  mech: { SP: 'currentSP', EP: 'currentEP', Heat: 'currentHeat' },
} as const

type TableVital = {
  label: string
  value: number
  max: number
  /** The record field − / + writes. */
  field: string
}

export type TableUnit = { kind: PinnedUnit['kind']; name: string; vitals: TableVital[] }

/** The pinned units, each vital with the field it writes; a vital with none is left out. */
export function tableUnits(pinned: readonly PinnedUnit[]): TableUnit[] {
  return pinned.map((unit) => {
    const fields: Record<string, string> = FIELD[unit.kind]
    return {
      kind: unit.kind,
      name: unit.name,
      vitals: unit.vitals.flatMap((v) => {
        const field = fields[v.label]
        return field === undefined ? [] : [{ ...v, field }]
      }),
    }
  })
}
