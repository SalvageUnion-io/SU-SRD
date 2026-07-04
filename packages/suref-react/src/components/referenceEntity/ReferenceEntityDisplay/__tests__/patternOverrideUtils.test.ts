import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { resolvePatternOverride, computeSvOverride } from '../patternOverrideUtils'
import type { PatternOverrideData } from '../referenceEntityDisplayTypes'

/**
 * Pure-helper coverage for pattern override resolution + TL1 salvage math.
 * The Mule chassis (SV 7, TL 1) carries the "Hauler Pattern"; its systems and
 * modules are real, known-value fixtures used here to hand-verify the sums.
 */
const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule') as SURefEntity
const nonChassis = SalvageUnionReference.Systems.find(
  (s) => s.name === '.50 Cal Machine Gun'
) as SURefEntity

describe('resolvePatternOverride', () => {
  test('matches a pattern by its normalized name (suffix-insensitive)', () => {
    // "Hauler" normalizes to the same key as the stored "Hauler Pattern".
    const override = { name: 'Hauler', systems: [], modules: [] } as PatternOverrideData
    const resolved = resolvePatternOverride(mule, override)
    expect(resolved?.name).toBe('Hauler Pattern')
  })

  test('returns undefined when no pattern name matches', () => {
    const override = { name: 'Nonexistent', systems: [], modules: [] } as PatternOverrideData
    expect(resolvePatternOverride(mule, override)).toBeUndefined()
  })

  test('returns undefined for an entity that has no patterns', () => {
    const override = { name: 'Hauler', systems: [], modules: [] } as PatternOverrideData
    expect(resolvePatternOverride(nonChassis, override)).toBeUndefined()
  })
})

describe('computeSvOverride', () => {
  test('sums chassis + systems + modules (SV × TL × count) and labels it TL1', () => {
    // Known fixture values:
    //   chassis Mule ............ SV 7  × TL 1                = 7
    //   .50 Cal Machine Gun ..... SV 2  × TL 1 × count 1      = 2
    //   Escape Hatch ............ SV 1  × TL 1 × count 2      = 2
    //   Comms Module ............ SV 1  × TL 1 × count 1      = 1
    //                                                    total = 12
    const override = {
      name: 'Custom',
      systems: [{ name: '.50 Cal Machine Gun' }, { name: 'Escape Hatch', count: 2 }],
      modules: [{ name: 'Comms Module' }],
    } as PatternOverrideData

    const result = computeSvOverride(mule, override)
    expect(result.value).toBe(12)
    expect(result.bottomLabel).toBe('TL1')
  })

  test('ignores items whose name resolves to no entity', () => {
    const override = {
      name: 'Custom',
      systems: [{ name: 'Totally Fake System' }],
      modules: [],
    } as PatternOverrideData

    // Only the chassis contributes: 7 × 1 = 7.
    expect(computeSvOverride(mule, override).value).toBe(7)
  })
})
