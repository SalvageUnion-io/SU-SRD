/**
 * What a Critical Injury roll writes to a pilot's sheet (r7 B6): a Minor or
 * a Major Injury, whose Max HP it costs is the sheet's own derivation.
 */

import { resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import type { PlayRoll } from './playRolls.model'
import { CRITICAL_INJURY_TABLE } from './tables.model'

/** The Critical Injury rows that write an injury, by their label (Core Book p.241). */
const INJURY_ROWS: Record<string, 'minor' | 'major'> = {
  'Minor Injury': 'minor',
  'Major Injury': 'major',
}

/** The injury a Critical Injury roll gave, by its row; null for any other roll. */
export function rolledInjury(
  roll: Pick<PlayRoll, 'tableName' | 'rolls'>
): 'minor' | 'major' | null {
  const die = roll.rolls[0]
  if (roll.tableName !== CRITICAL_INJURY_TABLE || die === undefined) return null
  const table = SalvageUnionReference.RollTables.getByName(CRITICAL_INJURY_TABLE)?.table
  const label = table ? resultForTable(table, die).result.label : undefined
  return label === undefined ? null : (INJURY_ROWS[label] ?? null)
}
