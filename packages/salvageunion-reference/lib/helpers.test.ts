import { describe, expect, it } from 'bun:test'
import { byTechLevelThenName, getUniqueTechLevels, techLevelRank } from './helpers.js'
import { SalvageUnionReference } from './index.js'

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

describe('byTechLevelThenName', () => {
  // The bug this comparator exists to end: two of four hand-written call sites
  // used `Number(a.techLevel)`. `Number('B')` is NaN, `NaN - NaN` is NaN, and a
  // comparator returning NaN leaves the sort implementation-defined.
  it('orders Bio and Nanite after the numeric tiers', () => {
    const items = [
      { techLevel: 'N' as const, name: 'Nanite Thing' },
      { techLevel: 3 as const, name: 'Tier Three' },
      { techLevel: 'B' as const, name: 'Bio Thing' },
      { techLevel: 1 as const, name: 'Tier One' },
    ]
    expect([...items].sort(byTechLevelThenName).map((i) => i.name)).toEqual([
      'Tier One',
      'Tier Three',
      'Bio Thing',
      'Nanite Thing',
    ])
  })

  it('the naive Number() version really does misorder the same input', () => {
    // A control, so this file records WHY the shared comparator exists rather
    // than merely asserting that it works. If `Number()` were adequate the
    // comparator would be needless indirection.
    //
    // The precise failure is subtler than "returns NaN". `Number('B') - 1` IS
    // NaN — but NaN is FALSY, so `NaN || a.name.localeCompare(b.name)` falls
    // straight through to the name tiebreak. So a Bio or Nanite item is not
    // randomly ordered; it is ordered purely by NAME, interleaved among the
    // numeric tiers instead of sorted after them. Quietly plausible output,
    // which is why it survived at two call sites.
    const naive = (
      a: { techLevel?: number | 'B' | 'N'; name: string },
      b: { techLevel?: number | 'B' | 'N'; name: string }
    ) => Number(a.techLevel) - Number(b.techLevel) || a.name.localeCompare(b.name)

    const items = [
      { techLevel: 'B' as const, name: 'Aardvark Plating' },
      { techLevel: 1 as const, name: 'Zinc Bolt' },
    ]

    // Naive: the Bio item leads, because 'Aardvark' < 'Zinc'.
    expect([...items].sort(naive).map((i) => i.name)).toEqual(['Aardvark Plating', 'Zinc Bolt'])

    // Correct: Bio ranks 7, so it follows every numeric tier regardless of name.
    expect([...items].sort(byTechLevelThenName).map((i) => i.name)).toEqual([
      'Zinc Bolt',
      'Aardvark Plating',
    ])
  })

  it('falls back to name within a tier', () => {
    const items = [
      { techLevel: 2 as const, name: 'Zeta' },
      { techLevel: 2 as const, name: 'Alpha' },
    ]
    expect([...items].sort(byTechLevelThenName).map((i) => i.name)).toEqual(['Alpha', 'Zeta'])
  })

  it('an absent Tech Level sorts last, not first', () => {
    const items = [
      { techLevel: undefined, name: 'Unranked' },
      { techLevel: 'N' as const, name: 'Nanite' },
      { techLevel: 1 as const, name: 'Tier One' },
    ]
    expect([...items].sort(byTechLevelThenName).map((i) => i.name)).toEqual([
      'Tier One',
      'Nanite',
      'Unranked',
    ])
  })
})
