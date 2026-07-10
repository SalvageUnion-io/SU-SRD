import { beforeAll, describe, expect, test } from 'bun:test'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

import { SalvageUnionReference } from './index.js'
import { rollOnTable } from './rollOnTable.js'
import { isColumnsTable } from './utils/resultForTable.js'

beforeAll(async () => {
  await SalvageUnionReference.preload(['roll-tables'])
})

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
    const core = SalvageUnionReference.RollTables.find((t) => t.name === 'Core Mechanic')
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

  test('out-of-range roll surfaces the validator message', () => {
    const core = SalvageUnionReference.RollTables.find((t) => t.name === 'Core Mechanic')
    const outcome = rollOnTable(defined(core).table, fixedRoller(21))
    if (outcome.success) throw new Error('expected failure')
    expect(outcome.error).toContain('between 1 and 20')
  })
})
