/**
 * A roll table is top-level unless another record claims it by `tableName`
 * (the ability, action or bay whose card renders it); a `rollTable` pointer
 * from a guide step or a choice leaves it top-level.
 */
import { describe, expect, test } from 'bun:test'
import type { EntitySchemaName } from '../index'
import { EntitySchemaNames, SalvageUnionReference, topLevelRollTables } from '../index'

const others = [...EntitySchemaNames].filter(
  (name): name is Exclude<EntitySchemaName, 'roll-tables'> => name !== 'roll-tables'
)
const records = () => SalvageUnionReference.getAllBySchemaNames(others).map(({ entity }) => entity)
const tables = () => SalvageUnionReference.RollTables.all()
const listed = () => new Set(topLevelRollTables(tables(), records()).map((table) => table.name))

describe('topLevelRollTables', () => {
  test('a table another record names by `tableName` is embedded, at any depth', () => {
    const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]
    const owners = [
      { name: 'Owner', tableName: 'A' },
      { name: 'Nested', actions: [{ name: 'Inner', tableName: 'B' }] },
      { name: 'Pointer', steps: [{ rollTable: 'C' }] },
      { name: 'Blank', tableName: '' },
    ]
    expect(topLevelRollTables(rows, owners).map((row) => row.name)).toEqual(['C', 'D'])
  })

  test('keeps the given order and every table when nothing claims one', () => {
    const rows = [{ name: 'B' }, { name: 'A' }]
    expect(topLevelRollTables(rows, [])).toEqual(rows)
  })

  test('the dataset: the book’s own tables are listed, the tables an entry prints are not', () => {
    const top = listed()
    // Printed under their own headings, or only pointed at (`rollTable`).
    for (const name of ['Core Mechanic', 'Critical Damage', 'Callsign Table', 'A.I. Personality'])
      expect(top.has(name)).toBe(true)
    // Each is an ability's, an action's or a bay's own roll.
    for (const name of ['System and Software Hacker', 'Mechapult', 'Trading Bay', 'Area Salvage'])
      expect(top.has(name)).toBe(false)
  })

  test('every embedded table still resolves from the record that claims it', () => {
    const top = listed()
    const embedded = tables().filter((table) => !top.has(table.name))
    expect(embedded.length).toBeGreaterThan(0)
    for (const table of embedded)
      expect(SalvageUnionReference.RollTables.getByName(table.name)?.table).toBeDefined()
  })
})
