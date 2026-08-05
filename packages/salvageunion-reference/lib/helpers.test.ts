import { describe, expect, it } from 'bun:test'
import {
  getCrawlerMutations,
  getMaxSpBonus,
  getUniqueTechLevels,
  getWeaponSlotCount,
  techLevelRank,
} from './helpers.js'
import { SalvageUnionReference } from './index.js'

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

/**
 * The tech-level sort order is a property of the game's TAXONOMY, so it lives
 * here and every sorter composes it. It was previously re-derived in five
 * places, one of which (ITUN's blank-create dialog) collapsed Bio and Nanite to
 * the same rank via POSITIVE_INFINITY — the copies had drifted apart.
 */
describe('techLevelRank', () => {
  it('keeps the numeric tiers in their own order', () => {
    expect([6, 1, 4, 2].sort((a, b) => techLevelRank(a) - techLevelRank(b))).toEqual([1, 2, 4, 6])
  })

  it('sorts Bio then Nanite after every numeric tier, and distinguishes them', () => {
    const mixed: (number | 'B' | 'N')[] = ['N', 3, 'B', 1]
    expect(mixed.sort((a, b) => techLevelRank(a) - techLevelRank(b))).toEqual([1, 3, 'B', 'N'])
    expect(techLevelRank('B')).toBeLessThan(techLevelRank('N'))
  })

  it('ranks a missing tech level last', () => {
    expect(techLevelRank(undefined)).toBe(Number.POSITIVE_INFINITY)
    expect(techLevelRank(6)).toBeLessThan(techLevelRank(undefined))
    expect(techLevelRank('N')).toBeLessThan(techLevelRank(undefined))
  })

  it('agrees with getUniqueTechLevels, which composes it', () => {
    const entities = SalvageUnionReference.Systems.all()
    const levels = getUniqueTechLevels(entities)
    const resorted = [...levels].sort((a, b) => techLevelRank(a) - techLevelRank(b))
    expect(resorted).toEqual(levels)
  })
})
