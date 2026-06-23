/**
 * Unit tests for computeCrawlerCapacity — bay and system cap enforcement.
 *
 * - Bays: derived from tech level (techLevel × 2: TL1=2, TL2=4, ... TL6=12).
 * - Weapons Systems: gated by CRAWLER TYPE, not tech level. Every crawler
 *   mounts one system (Core Book p. 213, step 3); the Battle Crawler mounts two
 *   (p. 216, "Improved Armour and Armaments").
 *
 * These caps are soft — violations are warnings, not hard blocks.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { computeCrawlerCapacity } from '../crawlerCapacity'
import type { CrawlerCapacityInput } from '../crawlerCapacity'

beforeAll(async () => {
  await SalvageUnionReference.preload(['crawler-tech-levels'])
})

describe('computeCrawlerCapacity — happy path', () => {
  it('returns zero usage for an empty crawler at TL1', () => {
    const input: CrawlerCapacityInput = { techLevel: 1, bays: [], systems: [] }
    const result = computeCrawlerCapacity(input)

    expect(result.baysUsed).toBe(0)
    expect(result.systemsUsed).toBe(0)
    expect(result.baysMax).toBeGreaterThan(0)
    expect(result.systemsMax).toBeGreaterThan(0)
    expect(result.violations).toHaveLength(0)
  })

  it('counts bays correctly', () => {
    const input: CrawlerCapacityInput = {
      techLevel: 2,
      bays: ['pilot-001', 'mech-001'],
      systems: [],
    }
    const result = computeCrawlerCapacity(input)
    expect(result.baysUsed).toBe(2)
    expect(result.violations).toHaveLength(0)
  })

  it('counts systems correctly', () => {
    const input: CrawlerCapacityInput = {
      techLevel: 1,
      bays: [],
      systems: ['drill-system', 'shield-system'],
    }
    const result = computeCrawlerCapacity(input)
    expect(result.systemsUsed).toBe(2)
  })

  it('baysMax scales with tech level', () => {
    const tl1 = computeCrawlerCapacity({ techLevel: 1, bays: [], systems: [] })
    const tl3 = computeCrawlerCapacity({ techLevel: 3, bays: [], systems: [] })
    expect(tl3.baysMax).toBeGreaterThan(tl1.baysMax)
  })

  it('systemsMax is gated by crawler type, not tech level', () => {
    // Every non-Battle crawler mounts one system regardless of tech level
    // (Core Book p. 213, step 3).
    const tl1 = computeCrawlerCapacity({ techLevel: 1, bays: [], systems: [] })
    const tl6 = computeCrawlerCapacity({ techLevel: 6, bays: [], systems: [] })
    expect(tl1.systemsMax).toBe(1)
    expect(tl6.systemsMax).toBe(1)
  })

  it('a Battle Crawler mounts two systems, others one', () => {
    // Battle Crawler ability "Improved Armour and Armaments" (Core Book p. 216).
    const battle = computeCrawlerCapacity({
      techLevel: 1,
      bays: [],
      systems: [],
      isBattleCrawler: true,
    })
    const nonBattle = computeCrawlerCapacity({ techLevel: 1, bays: [], systems: [] })
    expect(battle.systemsMax).toBe(2)
    expect(nonBattle.systemsMax).toBe(1)
  })

  it('a Battle Crawler permits two systems without violation', () => {
    const result = computeCrawlerCapacity({
      techLevel: 1,
      bays: [],
      systems: ['weapon-a', 'weapon-b'],
      isBattleCrawler: true,
    })
    expect(result.violations.filter((v) => v.kind === 'systems-over-capacity')).toHaveLength(0)
  })

  it('a non-Battle crawler with two systems is over capacity', () => {
    const result = computeCrawlerCapacity({
      techLevel: 1,
      bays: [],
      systems: ['weapon-a', 'weapon-b'],
    })
    const v = result.violations.find((x) => x.kind === 'systems-over-capacity')
    expect(v).toBeDefined()
    expect(v?.details.max).toBe(1)
    expect(v?.details.used).toBe(2)
  })

  it('produces no violations when at cap', () => {
    // TL1: baysMax = 2
    const tl1Caps = computeCrawlerCapacity({ techLevel: 1, bays: [], systems: [] })
    const bays = Array.from({ length: tl1Caps.baysMax }, (_, i) => `bay-${i}`)
    const input: CrawlerCapacityInput = { techLevel: 1, bays, systems: [] }
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
      systems: [],
    }
    const result = computeCrawlerCapacity(input)
    const v = result.violations.find((x) => x.kind === 'bays-over-capacity')
    expect(v).toBeDefined()
    expect(v?.details.used).toBe(3)
    expect(v?.details.max).toBe(result.baysMax)
  })

  it('raises systems-over-capacity when systems exceed cap', () => {
    // A non-Battle crawler has systemsMax = 1 — overflow with 2
    const tl1 = computeCrawlerCapacity({ techLevel: 1, bays: [], systems: [] })
    const systems = Array.from({ length: tl1.systemsMax + 1 }, (_, i) => `sys-${i}`)
    const input: CrawlerCapacityInput = { techLevel: 1, bays: [], systems }
    const result = computeCrawlerCapacity(input)
    const v = result.violations.find((x) => x.kind === 'systems-over-capacity')
    expect(v).toBeDefined()
    expect(v?.details.used).toBeGreaterThan(v?.details.max ?? 0)
  })

  it('raises tech-level-unknown for an unrecognised tech level slug', () => {
    // tech level must be 1-6; 0 is invalid
    const input: CrawlerCapacityInput = { techLevel: 0, bays: [], systems: [] }
    const result = computeCrawlerCapacity(input)
    expect(result.violations.find((v) => v.kind === 'tech-level-unknown')).toBeDefined()
  })

  it('can have both violations simultaneously', () => {
    const input: CrawlerCapacityInput = {
      techLevel: 1,
      bays: ['b1', 'b2', 'b3', 'b4'],
      systems: ['s1', 's2', 's3', 's4', 's5'],
    }
    const result = computeCrawlerCapacity(input)
    const kindsWithViolations = result.violations.map((v) => v.kind)
    expect(kindsWithViolations).toContain('bays-over-capacity')
    expect(kindsWithViolations).toContain('systems-over-capacity')
  })
})
