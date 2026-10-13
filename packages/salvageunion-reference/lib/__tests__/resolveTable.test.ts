/**
 * The roll table a card renders: INLINE (`table`) wins, else BY REFERENCE
 * (`tableName` -> the `roll-tables` schema); anything else resolves nothing.
 */
import { describe, expect, test } from 'bun:test'
import { resolveTable, SalvageUnionReference } from '../index'

const find = <T extends { name?: string }>(items: readonly T[], name: string): T => {
  const match = items.find((item) => item.name === name)
  if (!match) throw new Error(`fixture missing: ${name}`)
  return match
}

describe('resolveTable', () => {
  test('prefers an inline table, resolves a name, ignores anything else', () => {
    // An inline table wins over a name that would resolve to a different one.
    const inline = find(SalvageUnionReference.RollTables.all(), 'Trading Bay').table
    expect(resolveTable({ table: inline, tableName: 'Mechapult' })).toEqual(inline)
    expect(resolveTable({ tableName: 'Trading Bay' })).toBeDefined()
    expect(resolveTable({ tableName: 'no such table' })).toBeUndefined()
    expect(resolveTable({ tableName: '' })).toBeUndefined()
    expect(resolveTable(undefined)).toBeUndefined()
    expect(resolveTable(null)).toBeUndefined()
    expect(resolveTable('Trading Bay')).toBeUndefined()
  })
})
