/**
 * Every rules band is one row of its roll table.
 *
 * Each d20 band function here reads a table the book prints, and its readout
 * is that table's row. So the faces that share a row must share a band, and
 * two rows must never share one: a band that spans two rows, or a row split
 * across two bands, is a band the readout cannot name.
 */

import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import { resultForTable } from '../../utils/resultForTable'
import { coreRollBand } from '../coreMechanic'
import { reactorOverloadOutcome } from '../heatCheck'
import { criticalDamageOutcome, criticalInjuryOutcome } from '../takeDamage'

const FACES = Array.from({ length: 20 }, (_, i) => i + 1)

/** For each band, the table rows its faces land on (one, when it is a row). */
function rowsByBand(tableName: string, band: (roll: number) => string): Record<string, string[]> {
  const table = SalvageUnionReference.RollTables.getByName(tableName)?.table
  const rows: Record<string, string[]> = {}
  for (const face of FACES) {
    const row = resultForTable(table, face)
    if (!row.success) throw new Error(`${tableName} has no row for ${face}`)
    const keys = rows[band(face)] ?? []
    if (!keys.includes(row.key)) rows[band(face)] = [...keys, row.key]
  }
  return rows
}

describe('every rules band maps to one roll-table row', () => {
  const cases: [string, (roll: number) => string][] = [
    ['Core Mechanic', coreRollBand],
    ['Reactor Overload', reactorOverloadOutcome],
    ['Critical Damage', criticalDamageOutcome],
    ['Critical Injury', criticalInjuryOutcome],
  ]

  for (const [tableName, band] of cases) {
    test(tableName, () => {
      const rows = rowsByBand(tableName, band)
      // One row per band, and no row claimed by two bands.
      for (const keys of Object.values(rows)) expect(keys).toHaveLength(1)
      const claimed = Object.values(rows).flat()
      expect(new Set(claimed).size).toBe(claimed.length)
    })
  }

  test('the Reactor Overload 20 is the Overdrive row', () => {
    const table = SalvageUnionReference.RollTables.getByName('Reactor Overload')?.table
    expect(reactorOverloadOutcome(20)).toBe('overdrive')
    expect(resultForTable(table, 20).result.label).toBe('Reactor Overdrive')
  })
})
