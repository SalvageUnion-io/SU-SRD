import { describe, expect, test } from 'bun:test'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

import { SalvageUnionReference } from '../index'
import { d20ForTable, rollOnTable } from '../rollOnTable'
import { isColumnsTable } from '../utils/resultForTable'

function fixedRoller(...rolls: number[]) {
  const queue = [...rolls]
  return () => {
    const next = queue.shift()
    if (next === undefined) throw new Error('roller exhausted')
    return next
  }
}

describe('rollOnTable', () => {
  test('flat table: one roll, range key and value from the matched band', () => {
    const core = SalvageUnionReference.RollTables.getByName('Core Mechanic')
    expect(core).toBeDefined()
    const outcome = rollOnTable(defined(core).table, fixedRoller(20))
    if (!outcome.success || outcome.kind !== 'flat') throw new Error('expected flat success')
    expect(outcome.roll).toBe(20)
    expect(outcome.key).toBe('20')
    expect(outcome.value.length).toBeGreaterThan(0)
  })

  test('columns table: two rolls in column-then-entry order', () => {
    const columns = SalvageUnionReference.RollTables.all().find((t) => isColumnsTable(t.table))
    expect(columns).toBeDefined()
    const outcome = rollOnTable(defined(columns).table, fixedRoller(3, 17))
    if (!outcome.success || outcome.kind !== 'columns') throw new Error('expected columns success')
    expect(outcome.columnRoll).toBe(3)
    expect(outcome.entryRoll).toBe(17)
    expect(outcome.columnKey).toBe('1-4')
    expect(outcome.value.length).toBeGreaterThan(0)
  })

  test('missing table data fails without throwing', () => {
    const outcome = rollOnTable(undefined, fixedRoller(10))
    expect(outcome.success).toBe(false)
  })

  test('a roll that lands on no row has no effect: a result, not an error', () => {
    // Bio-Talon is `dramatic`: it prints only its 20.
    const bioTalon = SalvageUnionReference.RollTables.getByName('Bio-Talon')
    for (let roll = 1; roll <= 19; roll++) {
      expect(rollOnTable(defined(bioTalon).table, fixedRoller(roll))).toEqual({
        success: true,
        kind: 'no-effect',
        roll,
      })
    }
    const twenty = rollOnTable(defined(bioTalon).table, fixedRoller(20))
    expect(twenty.success && twenty.kind).toBe('flat')
  })

  test('a table with no rows is a fault, never no-effect', () => {
    const outcome = rollOnTable({ type: 'standard' } as never, fixedRoller(5))
    expect(outcome.success).toBe(false)
  })

  test('out-of-range roll surfaces the validator message', () => {
    const core = SalvageUnionReference.RollTables.getByName('Core Mechanic')
    const outcome = rollOnTable(defined(core).table, fixedRoller(21))
    if (outcome.success) throw new Error('expected failure')
    expect(outcome.error).toContain('between 1 and 20')
  })
})

describe('d20ForTable', () => {
  const plain = () => 1
  const dice = {
    names: ['Core Mechanic', 'Morale'],
    rollTable: (name: string) => ({ total: name === 'Morale' ? 17 : 14 }),
    rollD20: plain,
  }

  test("a named table's die is rollTable's total, whatever the name's case", () => {
    expect(d20ForTable('Morale', dice)()).toBe(17)
    expect(d20ForTable('core mechanic', dice)()).toBe(14)
  })

  test('any other table gets the plain d20', () => {
    expect(d20ForTable('Bio-Talon', dice)).toBe(plain)
  })
})
