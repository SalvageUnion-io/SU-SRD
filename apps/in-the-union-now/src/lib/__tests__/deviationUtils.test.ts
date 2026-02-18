import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { hasDeviated, resolveSourcePatternItems } from '../deviationUtils'
import type { PatternItem } from '../../types/common'
import type { MechSourcePattern } from '../mechUtils'

// ---------------------------------------------------------------------------
// hasDeviated
// ---------------------------------------------------------------------------

describe('hasDeviated', () => {
  const itemA: PatternItem = { schema_name: 'systems', schema_ref_id: 'laser-cutter', sort_order: 0 }
  const itemB: PatternItem = { schema_name: 'modules', schema_ref_id: 'reinforced-armour', sort_order: 1 }
  const itemC: PatternItem = { schema_name: 'systems', schema_ref_id: 'welding-torch', sort_order: 2 }

  test('identical sets → no deviation', () => {
    expect(hasDeviated([itemA, itemB], [itemA, itemB])).toBe(false)
  })

  test('reordered items → no deviation (ignores sort_order)', () => {
    const reordered = [
      { ...itemB, sort_order: 0 },
      { ...itemA, sort_order: 1 },
    ]
    expect(hasDeviated([itemA, itemB], reordered)).toBe(false)
  })

  test('extra item in mech → deviation', () => {
    expect(hasDeviated([itemA, itemB, itemC], [itemA, itemB])).toBe(true)
  })

  test('missing item in mech → deviation', () => {
    expect(hasDeviated([itemA], [itemA, itemB])).toBe(true)
  })

  test('different counts of same item → deviation', () => {
    const doubled = [
      { ...itemA, sort_order: 0 },
      { ...itemA, sort_order: 1 },
    ]
    expect(hasDeviated(doubled, [itemA])).toBe(true)
  })

  test('both empty → no deviation', () => {
    expect(hasDeviated([], [])).toBe(false)
  })

  test('mech empty, source has items → deviation', () => {
    expect(hasDeviated([], [itemA])).toBe(true)
  })

  test('same items but different schema_ref_id → deviation', () => {
    const different = { ...itemA, schema_ref_id: 'plasma-cutter' }
    expect(hasDeviated([different], [itemA])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// resolveSourcePatternItems
// ---------------------------------------------------------------------------

describe('resolveSourcePatternItems', () => {
  test('player source with pattern returns pattern_items', () => {
    const source: MechSourcePattern = { kind: 'player', patternId: 'abc-123' }
    const playerPattern = {
      id: 'abc-123',
      user_id: 'user-1',
      name: 'Test',
      chassis_ref: 'iron-mongrel',
      description: null,
      visible: true,
      image_path: null,
      created_at: '',
      updated_at: '',
      pattern_items: [
        { schema_name: 'systems' as const, schema_ref_id: 'laser-cutter', sort_order: 0 },
      ],
    }
    const result = resolveSourcePatternItems(source, playerPattern)
    expect(result).toEqual(playerPattern.pattern_items)
  })

  test('player source without pattern returns null', () => {
    const source: MechSourcePattern = { kind: 'player', patternId: 'abc-123' }
    expect(resolveSourcePatternItems(source, null)).toBeNull()
    expect(resolveSourcePatternItems(source, undefined)).toBeNull()
  })

  test('reference source with valid chassisRef::patternName resolves items', () => {
    // Look up a real chassis with patterns from the reference data
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const haulerPattern = mule.patterns!.find((p) => p.name === 'Hauler Pattern')!
    const source: MechSourcePattern = { kind: 'reference', refPatternId: `${mule.id}::${haulerPattern.name}` }
    const result = resolveSourcePatternItems(source)
    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThan(0)
    // Every item should have systems or modules schema_name
    for (const item of result!) {
      expect(['systems', 'modules']).toContain(item.schema_name)
    }
  })

  test('reference source with invalid chassisRef returns null', () => {
    const source: MechSourcePattern = { kind: 'reference', refPatternId: 'nonexistent-uuid::Balanced' }
    expect(resolveSourcePatternItems(source)).toBeNull()
  })

  test('reference source with invalid patternName returns null', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const source: MechSourcePattern = { kind: 'reference', refPatternId: `${mule.id}::NonexistentPattern` }
    expect(resolveSourcePatternItems(source)).toBeNull()
  })

  test('reference source with malformed id (no ::) returns null', () => {
    const source: MechSourcePattern = { kind: 'reference', refPatternId: 'no-separator-here' }
    expect(resolveSourcePatternItems(source)).toBeNull()
  })
})
