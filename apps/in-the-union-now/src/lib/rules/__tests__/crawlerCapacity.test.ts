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

  it('boundary: exactly at bay cap (used === baysMax) does NOT raise a violation', () => {
    // TL1 baysMax = 2 — fill exactly to cap
    const bays = ['bay-0', 'bay-1']
    const result = computeCrawlerCapacity({ techLevel: 1, bays, systems: [] })
    expect(result.baysUsed).toBe(result.baysMax)
    expect(result.violations.filter((v) => v.kind === 'bays-over-capacity')).toHaveLength(0)
  })

  it('boundary: exactly one over bay cap (used === baysMax + 1) raises a violation', () => {
    // TL1 baysMax = 2 — one over with 3
    const result = computeCrawlerCapacity({
      techLevel: 1,
      bays: ['bay-0', 'bay-1', 'bay-2'],
      systems: [],
    })
    const v = result.violations.find((x) => x.kind === 'bays-over-capacity')
    expect(v).toBeDefined()
    expect(v?.details.used).toBe(result.baysMax + 1)
  })
})

describe('computeCrawlerCapacity — tech-level extremes', () => {
  it('min tech level (TL1): baysMax 2, systemsMax 4', () => {
    const result = computeCrawlerCapacity({ techLevel: 1, bays: [], systems: [] })
    expect(result.baysMax).toBe(2)
    expect(result.systemsMax).toBe(4)
  })

  it('max tech level (TL6): baysMax 12, systemsMax 24, fillable to cap with no violation', () => {
    const bays = Array.from({ length: 12 }, (_, i) => `bay-${i}`)
    const systems = Array.from({ length: 24 }, (_, i) => `sys-${i}`)
    const result = computeCrawlerCapacity({ techLevel: 6, bays, systems })
    expect(result.baysMax).toBe(12)
    expect(result.systemsMax).toBe(24)
    expect(result.violations).toHaveLength(0)
  })

  it('above max tech level (TL7) is treated as unknown, not the highest cap', () => {
    const result = computeCrawlerCapacity({ techLevel: 7, bays: ['b1'], systems: [] })
    expect(result.violations.find((v) => v.kind === 'tech-level-unknown')).toBeDefined()
    expect(result.baysMax).toBe(0)
    expect(result.systemsMax).toBe(0)
  })

  it('negative tech level is treated as unknown', () => {
    const result = computeCrawlerCapacity({ techLevel: -1, bays: [], systems: [] })
    expect(result.violations.find((v) => v.kind === 'tech-level-unknown')).toBeDefined()
  })
})
