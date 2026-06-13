/**
 * Unit tests for computeCrawlerCapacity — bay and system cap enforcement.
 *
 * Crawler capacity is derived from tech level per the Salvage Union Workshop Manual:
 * - Bays: equal to techLevel × 2  (Hamlet TL1=2, Village TL2=4, ... Megacity TL6=12)
 * - Systems: equal to techLevel × 4 (TL1=4, TL2=8, ... TL6=24)
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

  it('baysMax and systemsMax scale with tech level', () => {
    const tl1 = computeCrawlerCapacity({ techLevel: 1, bays: [], systems: [] })
    const tl3 = computeCrawlerCapacity({ techLevel: 3, bays: [], systems: [] })
    expect(tl3.baysMax).toBeGreaterThan(tl1.baysMax)
    expect(tl3.systemsMax).toBeGreaterThan(tl1.systemsMax)
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
    // TL1 has systemsMax = 4 — overflow with 5
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
