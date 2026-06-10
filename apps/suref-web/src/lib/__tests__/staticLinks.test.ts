import { describe, test, expect } from 'bun:test'
import { resolveTraitHref } from '../staticLinks'

describe('resolveTraitHref', () => {
  test('maps a trait name to its trait item URL', () => {
    expect(resolveTraitHref('armour')).toBe('/schema/traits/item/armour/')
  })
  test('falls back to keywords for keyword-only types', () => {
    expect(resolveTraitHref('irradiated')).toBe('/schema/keywords/item/irradiated/')
  })
  test('returns null for unknown types', () => {
    expect(resolveTraitHref('definitely-not-a-trait')).toBeNull()
  })
})
