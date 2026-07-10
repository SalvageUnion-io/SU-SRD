import { describe, it, expect } from 'bun:test'
import { SalvageUnionReference } from './index.js'
import { getCrawlerMutations, getWeaponSlotCount, getMaxSpBonus } from './helpers.js'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

const battleCrawler = defined(SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle'))
const engineeringCrawler = defined(
  SalvageUnionReference.Crawlers.find((c) => c.name === 'Engineering')
)

describe('getCrawlerMutations', () => {
  it('returns mutations for Battle crawler', () => {
    const mutations = getCrawlerMutations(battleCrawler.id)
    expect(mutations).toHaveLength(2)
    expect(mutations).toContainEqual({ type: 'weapon_slots', value: 1 })
    expect(mutations).toContainEqual({ type: 'max_sp_bonus', value: 5 })
  })

  it('returns empty array for crawler without mutations', () => {
    expect(getCrawlerMutations(engineeringCrawler.id)).toEqual([])
  })

  it('returns empty array for unknown ID', () => {
    expect(getCrawlerMutations('nonexistent-id')).toEqual([])
  })
})

describe('getWeaponSlotCount', () => {
  it('returns 2 for Battle crawler (1 base + 1 bonus)', () => {
    expect(getWeaponSlotCount(battleCrawler.id)).toBe(2)
  })

  it('returns 1 for Engineering crawler (base only)', () => {
    expect(getWeaponSlotCount(engineeringCrawler.id)).toBe(1)
  })

  it('returns 1 for unknown ID (base only)', () => {
    expect(getWeaponSlotCount('nonexistent-id')).toBe(1)
  })
})

describe('getMaxSpBonus', () => {
  it('returns 5 for Battle crawler', () => {
    expect(getMaxSpBonus(battleCrawler.id)).toBe(5)
  })

  it('returns 0 for Engineering crawler', () => {
    expect(getMaxSpBonus(engineeringCrawler.id)).toBe(0)
  })

  it('returns 0 for unknown ID', () => {
    expect(getMaxSpBonus('nonexistent-id')).toBe(0)
  })
})
