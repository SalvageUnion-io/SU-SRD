/**
 * Pure embed-shaping tests — no discord.js interaction objects needed.
 * Uses real reference data (preloaded) so /lookup shapes match production.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference, rollOnTable } from 'salvageunion-reference'

import { ROLL_EMBED_FOOTER, buildRollEmbedData, entityUrl, getColor, truncate } from '../format.js'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

function fixedRoller(...rolls: number[]) {
  const queue = [...rolls]
  return () => {
    const next = queue.shift()
    if (next === undefined) throw new Error('roller exhausted')
    return next
  }
}

describe('getColor', () => {
  test('maps Core Mechanic tiers', () => {
    expect(getColor(20)).toBe(0x00ff00)
    expect(getColor(11)).toBe(0x228b22)
    expect(getColor(6)).toBe(0xffd700)
    expect(getColor(2)).toBe(0xff4500)
    expect(getColor(1)).toBe(0x8b0000)
  })
})

describe('truncate', () => {
  test('passes short text through and caps long text', () => {
    expect(truncate('short', 100)).toBe('short')
    const long = 'word '.repeat(100)
    expect(truncate(long, 50).length).toBeLessThanOrEqual(50)
    expect(truncate(long, 50).endsWith('…')).toBe(true)
  })
})

describe('buildRollEmbedData', () => {
  test('flat table: title from label, three inline fields', () => {
    const core = SalvageUnionReference.RollTables.find((t) => t.name === 'Core Mechanic')
    if (!core) throw new Error('Core Mechanic table missing from reference data')
    const outcome = rollOnTable(core.table, fixedRoller(20))
    const data = buildRollEmbedData('Core Mechanic', outcome)
    expect(data.color).toBe(0x00ff00)
    expect(data.fields.map((f) => f.name)).toEqual(['Table', 'Roll', 'Range'])
    expect(data.fields[1]?.value).toBe('20')
    expect(data.description?.length).toBeGreaterThan(0)
  })

  test('columns table: column + entry roll fields', () => {
    const columns = SalvageUnionReference.RollTables.all().find((t) => {
      const probe = rollOnTable(t.table, fixedRoller(1, 1))
      return probe.success && probe.kind === 'columns'
    })
    expect(columns).toBeDefined()
    if (!columns) throw new Error('expected a columns-type roll table')
    const outcome = rollOnTable(columns.table, fixedRoller(3, 17))
    const data = buildRollEmbedData(columns.name, outcome)
    expect(data.fields.map((f) => f.name)).toEqual(['Table', 'Column Roll', 'Entry Roll'])
    expect(data.fields[1]?.value).toContain('3 (1-4)')
  })

  test('failure outcome renders an error embed instead of throwing', () => {
    const data = buildRollEmbedData('Bogus', { success: false, error: 'nope' })
    expect(data.title).toContain('Error')
    expect(data.description).toBe('nope')
  })
})

describe('entityUrl', () => {
  test('matches the schema/item route shape', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0]
    if (!chassis) throw new Error('expected at least one chassis in reference data')
    expect(entityUrl('chassis', chassis)).toMatch(
      /^https:\/\/salvageunion\.io\/schema\/chassis\/item\/[a-z0-9-]+$/
    )
  })
})

describe('roll embed footer attribution', () => {
  test('credits Randsum.dev, since rolls are powered by @randsum/roller', () => {
    expect(ROLL_EMBED_FOOTER).toContain('Powered by Randsum.dev')
    expect(ROLL_EMBED_FOOTER).toContain('Salvage Union Reference')
  })
})
