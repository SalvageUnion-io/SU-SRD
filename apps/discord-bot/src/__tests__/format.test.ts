/**
 * Pure embed-shaping tests — no discord.js interaction objects needed.
 * Uses real reference data (preloaded) so /lookup shapes match production.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { entityUrl, ROLL_ATTRIBUTION, truncate } from '../format.js'

describe('truncate', () => {
  test('passes short text through and caps long text', () => {
    expect(truncate('short', 100)).toBe('short')
    const long = 'word '.repeat(100)
    expect(truncate(long, 50).length).toBeLessThanOrEqual(50)
    expect(truncate(long, 50).endsWith('…')).toBe(true)
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

describe('roll attribution', () => {
  test('credits Randsum.dev, since rolls are powered by @randsum/roller', () => {
    expect(ROLL_ATTRIBUTION).toContain('Powered by Randsum.dev')
    expect(ROLL_ATTRIBUTION).toContain('Salvage Union Reference')
  })
})
