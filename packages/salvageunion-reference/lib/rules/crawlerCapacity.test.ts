/**
 * Unit tests for computeCrawlerCapacity — bay and weapon-system cap enforcement.
 *
 * - Bays: derived from tech level (techLevel × 2: TL1=2, TL2=4, ... TL6=12).
 * - Weapons Systems: gated by CRAWLER TYPE, not tech level. Every crawler mounts
 *   one weapons system (Core Book p. 213, step 3); the Battle Crawler mounts two
 *   (p. 216, "Improved Armour and Armaments"). Only WEAPONS systems count —
 *   the caller passes the already-filtered weapon-system slugs (see
 *   isWeaponSystem in ../crawlerSystems); non-weapon systems are unlimited.
 *
 * These caps are soft — violations are warnings, not hard blocks.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index.js'
import type { CrawlerCapacityInput } from './crawlerCapacity.js'
import { computeCrawlerCapacity } from './crawlerCapacity.js'

beforeAll(async () => {
  await SalvageUnionReference.preload(['crawler-tech-levels'])
})

describe('computeCrawlerCapacity — happy path', () => {
  it('returns zero usage for an empty crawler at TL1', () => {
    const input: CrawlerCapacityInput = { techLevel: 1, bays: [], weaponSystems: [] }
    const result = computeCrawlerCapacity(input)

    expect(result.baysUsed).toBe(0)
    expect(result.weaponSystemsUsed).toBe(0)
    expect(result.baysMax).toBeGreaterThan(0)
    expect(result.weaponSystemsMax).toBeGreaterThan(0)
    expect(result.violations).toHaveLength(0)
  })

  it('counts bays correctly', () => {
    const input: CrawlerCapacityInput = {
      techLevel: 2,
      bays: ['pilot-001', 'mech-001'],
      weaponSystems: [],
    }
    const result = computeCrawlerCapacity(input)
    expect(result.baysUsed).toBe(2)
    expect(result.violations).toHaveLength(0)
  })

  it('counts weapon systems correctly', () => {
    const input: CrawlerCapacityInput = {
      techLevel: 1,
      bays: [],
      weaponSystems: ['drill-system', 'shield-system'],
    }
    const result = computeCrawlerCapacity(input)
    expect(result.weaponSystemsUsed).toBe(2)
  })

  it('baysMax scales with tech level', () => {
    const tl1 = computeCrawlerCapacity({ techLevel: 1, bays: [], weaponSystems: [] })
    const tl3 = computeCrawlerCapacity({ techLevel: 3, bays: [], weaponSystems: [] })
    expect(tl3.baysMax).toBeGreaterThan(tl1.baysMax)
  })

  it('weaponSystemsMax is gated by crawler type, not tech level', () => {
    // Every non-Battle crawler mounts one weapons system regardless of tech
    // level (Core Book p. 213, step 3).
    const tl1 = computeCrawlerCapacity({ techLevel: 1, bays: [], weaponSystems: [] })
    const tl6 = computeCrawlerCapacity({ techLevel: 6, bays: [], weaponSystems: [] })
    expect(tl1.weaponSystemsMax).toBe(1)
    expect(tl6.weaponSystemsMax).toBe(1)
  })

  it('a Battle Crawler mounts two weapons systems, others one', () => {
    // Battle Crawler ability "Improved Armour and Armaments" (Core Book p. 216).
    const battle = computeCrawlerCapacity({
      techLevel: 1,
      bays: [],
      weaponSystems: [],
      isBattleCrawler: true,
    })
    const nonBattle = computeCrawlerCapacity({ techLevel: 1, bays: [], weaponSystems: [] })
    expect(battle.weaponSystemsMax).toBe(2)
    expect(nonBattle.weaponSystemsMax).toBe(1)
  })

  it('a Battle Crawler permits two weapons systems without violation', () => {
    const result = computeCrawlerCapacity({
      techLevel: 1,
      bays: [],
      weaponSystems: ['weapon-a', 'weapon-b'],
      isBattleCrawler: true,
    })
    expect(result.violations.filter((v) => v.kind === 'weapon-systems-over-capacity')).toHaveLength(
      0
    )
  })

  it('a non-Battle crawler with two weapons systems is over capacity', () => {
    const result = computeCrawlerCapacity({
      techLevel: 1,
      bays: [],
      weaponSystems: ['weapon-a', 'weapon-b'],
    })
    const v = result.violations.find((x) => x.kind === 'weapon-systems-over-capacity')
    expect(v).toBeDefined()
    expect(v?.details.max).toBe(1)
    expect(v?.details.used).toBe(2)
  })

  it('a single weapons system is within cap (non-weapon systems are filtered out upstream)', () => {
    // Non-weapon systems are filtered out by the caller, so they never reach
    // here — one weapons system at the cap is fine no matter how many other
    // systems the crawler installs.
    const result = computeCrawlerCapacity({
      techLevel: 1,
      bays: [],
      weaponSystems: ['the-one-weapon'],
    })
    expect(result.violations.filter((v) => v.kind === 'weapon-systems-over-capacity')).toHaveLength(
      0
    )
    expect(result.weaponSystemsUsed).toBe(1)
    expect(result.weaponSystemsMax).toBe(1)
  })

  it('produces no violations when at cap', () => {
    // TL1: baysMax = 2
    const tl1Caps = computeCrawlerCapacity({ techLevel: 1, bays: [], weaponSystems: [] })
    const bays = Array.from({ length: tl1Caps.baysMax }, (_, i) => `bay-${i}`)
    const input: CrawlerCapacityInput = { techLevel: 1, bays, weaponSystems: [] }
    const result = computeCrawlerCapacity(input)
    expect(result.violations.filter((v) => v.kind === 'bays-over-capacity')).toHaveLength(0)
  })
})

describe('computeCrawlerCapacity — violations', () => {
  it('raises bays-over-capacity when bays exceed cap', () => {
    // TL1 has baysMax = 2 — overflow with 3
    const input: CrawlerCapacityInput = {
      techLevel: 1,
      bays: ['bay-1', 'bay-2', 'bay-3'],
      weaponSystems: [],
    }
    const result = computeCrawlerCapacity(input)
    const v = result.violations.find((x) => x.kind === 'bays-over-capacity')
    expect(v).toBeDefined()
    expect(v?.details.used).toBe(3)
    expect(v?.details.max).toBe(result.baysMax)
  })

  it('raises weapon-systems-over-capacity when weapons systems exceed cap', () => {
    // A non-Battle crawler has weaponSystemsMax = 1 — overflow with 2
    const tl1 = computeCrawlerCapacity({ techLevel: 1, bays: [], weaponSystems: [] })
    const weaponSystems = Array.from({ length: tl1.weaponSystemsMax + 1 }, (_, i) => `sys-${i}`)
    const input: CrawlerCapacityInput = { techLevel: 1, bays: [], weaponSystems }
    const result = computeCrawlerCapacity(input)
    const v = result.violations.find((x) => x.kind === 'weapon-systems-over-capacity')
    expect(v).toBeDefined()
    expect(v?.details.used).toBeGreaterThan(v?.details.max ?? 0)
  })

  it('raises tech-level-unknown for an unrecognised tech level slug', () => {
    // tech level must be 1-6; 0 is invalid
    const input: CrawlerCapacityInput = { techLevel: 0, bays: [], weaponSystems: [] }
    const result = computeCrawlerCapacity(input)
    expect(result.violations.find((v) => v.kind === 'tech-level-unknown')).toBeDefined()
  })

  it('can have both bay and weapon-system violations simultaneously', () => {
    const input: CrawlerCapacityInput = {
      techLevel: 1,
      bays: ['b1', 'b2', 'b3', 'b4'],
      weaponSystems: ['s1', 's2', 's3', 's4', 's5'],
    }
    const result = computeCrawlerCapacity(input)
    const kindsWithViolations = result.violations.map((v) => v.kind)
    expect(kindsWithViolations).toContain('bays-over-capacity')
    expect(kindsWithViolations).toContain('weapon-systems-over-capacity')
  })
})
