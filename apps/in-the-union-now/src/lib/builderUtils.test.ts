import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis, SURefSystem, SURefModule } from 'salvageunion-reference'
import type { PatternItem } from '../types/common'
import type { BuilderState, ResolvedItem } from './builderUtils'
import {
  computeCapacity,
  computeSalvageValue,
  STARTING_MECH_BUDGET,
  nextSortOrder,
  builderToCreateInput,
  resolvePatternItems,
  patternToBuilderState,
  applyPatternItems,
  patternItemsToOverride,
  referencePatternToItems,
} from './builderUtils'

// Minimal test fixtures
const mockChassis = {
  systemSlots: 3,
  moduleSlots: 2,
} as SURefChassis

const mockSystem = (slots: number) =>
  ({
    slotsRequired: slots,
    schemaName: 'systems',
  }) as SURefSystem & { schemaName: 'systems' }

const mockModule = (slots: number) =>
  ({
    slotsRequired: slots,
    schemaName: 'modules',
  }) as SURefModule & { schemaName: 'modules' }

function makeResolvedItem(
  schemaName: 'systems' | 'modules',
  sortOrder: number,
  entity: SURefSystem | SURefModule
): ResolvedItem {
  return {
    schema_name: schemaName,
    schema_ref_id: 'test-id',
    sort_order: sortOrder,
    entity,
  }
}

// ----- computeCapacity -----

describe('computeCapacity', () => {
  test('returns zeros when chassis is null', () => {
    const result = computeCapacity(null, [])
    expect(result.systemSlotsUsed).toBe(0)
    expect(result.systemSlotsTotal).toBe(0)
    expect(result.moduleSlotsUsed).toBe(0)
    expect(result.moduleSlotsTotal).toBe(0)
    expect(result.isValid).toBe(true)
  })

  test('returns zeros when chassis is undefined', () => {
    const result = computeCapacity(undefined, [])
    expect(result.systemSlotsUsed).toBe(0)
    expect(result.systemSlotsTotal).toBe(0)
    expect(result.isValid).toBe(true)
  })

  test('counts system and module slots separately', () => {
    const items: ResolvedItem[] = [
      makeResolvedItem('systems', 0, mockSystem(1)),
      makeResolvedItem('systems', 1, mockSystem(2)),
      makeResolvedItem('modules', 2, mockModule(1)),
    ]
    const result = computeCapacity(mockChassis, items)
    expect(result.systemSlotsUsed).toBe(3)
    expect(result.systemSlotsTotal).toBe(3)
    expect(result.moduleSlotsUsed).toBe(1)
    expect(result.moduleSlotsTotal).toBe(2)
    expect(result.isValid).toBe(true)
  })

  test('detects over-capacity for systems', () => {
    const items: ResolvedItem[] = [
      makeResolvedItem('systems', 0, mockSystem(2)),
      makeResolvedItem('systems', 1, mockSystem(2)),
    ]
    const result = computeCapacity(mockChassis, items)
    expect(result.isOverSystemCapacity).toBe(true)
    expect(result.isOverModuleCapacity).toBe(false)
    expect(result.isValid).toBe(false)
  })

  test('detects over-capacity for modules', () => {
    const items: ResolvedItem[] = [
      makeResolvedItem('modules', 0, mockModule(2)),
      makeResolvedItem('modules', 1, mockModule(1)),
    ]
    const result = computeCapacity(mockChassis, items)
    expect(result.isOverSystemCapacity).toBe(false)
    expect(result.isOverModuleCapacity).toBe(true)
    expect(result.isValid).toBe(false)
  })

  test('detects simultaneous system and module over-capacity', () => {
    const items: ResolvedItem[] = [
      makeResolvedItem('systems', 0, mockSystem(4)),
      makeResolvedItem('modules', 1, mockModule(3)),
    ]
    const result = computeCapacity(mockChassis, items)
    expect(result.isOverSystemCapacity).toBe(true)
    expect(result.isOverModuleCapacity).toBe(true)
    expect(result.isValid).toBe(false)
  })

  test('exactly at capacity is valid', () => {
    const items: ResolvedItem[] = [
      makeResolvedItem('systems', 0, mockSystem(3)),
      makeResolvedItem('modules', 1, mockModule(2)),
    ]
    const result = computeCapacity(mockChassis, items)
    expect(result.isValid).toBe(true)
    expect(result.isOverSystemCapacity).toBe(false)
    expect(result.isOverModuleCapacity).toBe(false)
  })

  test('empty items with chassis shows full capacity available', () => {
    const result = computeCapacity(mockChassis, [])
    expect(result.systemSlotsUsed).toBe(0)
    expect(result.systemSlotsTotal).toBe(3)
    expect(result.moduleSlotsUsed).toBe(0)
    expect(result.moduleSlotsTotal).toBe(2)
    expect(result.isValid).toBe(true)
  })

  test('works with real chassis data', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const result = computeCapacity(mule, [])
    expect(result.systemSlotsTotal).toBe(mule.systemSlots!)
    expect(result.moduleSlotsTotal).toBe(mule.moduleSlots!)
    expect(result.isValid).toBe(true)
  })
})

// ----- computeSalvageValue -----

describe('computeSalvageValue', () => {
  test('returns zeros when chassis is null and no items', () => {
    const result = computeSalvageValue(null, [])
    expect(result.chassisCost).toBe(0)
    expect(result.itemsCost).toBe(0)
    expect(result.totalCost).toBe(0)
    expect(result.remainingBudget).toBe(STARTING_MECH_BUDGET)
    expect(result.isLegalStartingMech).toBe(true)
  })

  test('returns zeros when chassis is undefined and no items', () => {
    const result = computeSalvageValue(undefined, [])
    expect(result.chassisCost).toBe(0)
    expect(result.totalCost).toBe(0)
    expect(result.isLegalStartingMech).toBe(true)
  })

  test('sums chassis + items costs', () => {
    // Use real game data for accurate salvage values
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const sys = SalvageUnionReference.Systems.all()
    const firstSystem = sys[0]!
    const items: ResolvedItem[] = [makeResolvedItem('systems', 0, firstSystem)]

    const result = computeSalvageValue(mule, items)
    expect(result.chassisCost).toBe(mule.salvageValue!)
    expect(result.itemsCost).toBe(firstSystem.salvageValue!)
    expect(result.totalCost).toBe(mule.salvageValue! + firstSystem.salvageValue!)
  })

  test('exactly at budget is legal', () => {
    // Mock a chassis with salvageValue = 20
    const chassis = { salvageValue: 20 } as SURefChassis
    const result = computeSalvageValue(chassis, [])
    expect(result.totalCost).toBe(20)
    expect(result.isLegalStartingMech).toBe(true)
    expect(result.remainingBudget).toBe(0)
  })

  test('over budget is not legal', () => {
    const chassis = { salvageValue: 21 } as SURefChassis
    const result = computeSalvageValue(chassis, [])
    expect(result.totalCost).toBe(21)
    expect(result.isLegalStartingMech).toBe(false)
    expect(result.remainingBudget).toBe(-1)
  })

  test('null chassis with items only counts items', () => {
    const sys = SalvageUnionReference.Systems.all()
    const firstSystem = sys[0]!
    const items: ResolvedItem[] = [makeResolvedItem('systems', 0, firstSystem)]

    const result = computeSalvageValue(null, items)
    expect(result.chassisCost).toBe(0)
    expect(result.itemsCost).toBe(firstSystem.salvageValue!)
    expect(result.totalCost).toBe(firstSystem.salvageValue!)
  })

  test('remainingBudget is STARTING_MECH_BUDGET minus totalCost', () => {
    const chassis = { salvageValue: 5 } as SURefChassis
    const system = {
      salvageValue: 3,
      slotsRequired: 1,
      schemaName: 'systems',
    } as unknown as SURefSystem
    const items: ResolvedItem[] = [makeResolvedItem('systems', 0, system)]

    const result = computeSalvageValue(chassis, items)
    expect(result.totalCost).toBe(8)
    expect(result.remainingBudget).toBe(STARTING_MECH_BUDGET - 8)
  })

  test('works with real game data integration', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const systems = SalvageUnionReference.Systems.all()
    const modules = SalvageUnionReference.Modules.all()

    const items: ResolvedItem[] = [
      makeResolvedItem('systems', 0, systems[0]!),
      makeResolvedItem('modules', 1, modules[0]!),
    ]

    const result = computeSalvageValue(mule, items)
    const expectedTotal = mule.salvageValue! + systems[0]!.salvageValue! + modules[0]!.salvageValue!
    expect(result.totalCost).toBe(expectedTotal)
    expect(result.isLegalStartingMech).toBe(expectedTotal <= STARTING_MECH_BUDGET)
  })

  test('STARTING_MECH_BUDGET is 20', () => {
    expect(STARTING_MECH_BUDGET).toBe(20)
  })
})

// ----- nextSortOrder -----

describe('nextSortOrder', () => {
  test('returns 0 for empty array', () => {
    expect(nextSortOrder([])).toBe(0)
  })

  test('returns max + 1', () => {
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'a', sort_order: 0 },
      { schema_name: 'modules', schema_ref_id: 'b', sort_order: 5 },
      { schema_name: 'systems', schema_ref_id: 'c', sort_order: 3 },
    ]
    expect(nextSortOrder(items)).toBe(6)
  })

  test('returns 1 for single item at 0', () => {
    const items: PatternItem[] = [{ schema_name: 'systems', schema_ref_id: 'a', sort_order: 0 }]
    expect(nextSortOrder(items)).toBe(1)
  })

  test('handles non-contiguous sort orders', () => {
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'a', sort_order: 10 },
      { schema_name: 'modules', schema_ref_id: 'b', sort_order: 20 },
    ]
    expect(nextSortOrder(items)).toBe(21)
  })
})

// ----- builderToCreateInput -----

describe('builderToCreateInput', () => {
  const validState: BuilderState = {
    name: 'My Pattern',
    chassisRef: 'iron-mongrel',
    description: 'A test pattern',
    visible: true,
    customImageUrl: null,
    items: [{ schema_name: 'systems', schema_ref_id: 'laser', sort_order: 0 }],
  }

  test('returns null when name is empty', () => {
    expect(builderToCreateInput({ ...validState, name: '' })).toBeNull()
  })

  test('returns null when name is only whitespace', () => {
    expect(builderToCreateInput({ ...validState, name: '   ' })).toBeNull()
  })

  test('returns null when chassisRef is null', () => {
    expect(builderToCreateInput({ ...validState, chassisRef: null })).toBeNull()
  })

  test('returns valid input for valid state', () => {
    const result = builderToCreateInput({
      ...validState,
      name: '  My Pattern  ',
    })
    expect(result).toEqual({
      name: 'My Pattern',
      chassis_ref: 'iron-mongrel',
      description: 'A test pattern',
      visible: true,
      image_path: null,
      pattern_items: validState.items,
    })
  })

  test('trims name whitespace', () => {
    const result = builderToCreateInput({ ...validState, name: '  Trimmed  ' })
    expect(result?.name).toBe('Trimmed')
  })

  test('omits description when empty', () => {
    const result = builderToCreateInput({ ...validState, description: '  ' })
    expect(result?.description).toBeUndefined()
  })

  test('omits description when empty string', () => {
    const result = builderToCreateInput({ ...validState, description: '' })
    expect(result?.description).toBeUndefined()
  })

  test('preserves visible=false', () => {
    const result = builderToCreateInput({ ...validState, visible: false })
    expect(result?.visible).toBe(false)
  })

  test('preserves empty items array', () => {
    const result = builderToCreateInput({ ...validState, items: [] })
    expect(result?.pattern_items).toEqual([])
  })

  test('preserves multiple items', () => {
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'a', sort_order: 0 },
      { schema_name: 'systems', schema_ref_id: 'b', sort_order: 1 },
      { schema_name: 'modules', schema_ref_id: 'c', sort_order: 2 },
    ]
    const result = builderToCreateInput({ ...validState, items })
    expect(result?.pattern_items).toEqual(items)
  })

  test('does not include customImageUrl in output', () => {
    const result = builderToCreateInput({
      ...validState,
      customImageUrl: 'blob:something',
    })
    expect(result).not.toHaveProperty('customImageUrl')
    expect(result).not.toHaveProperty('custom_image_url')
  })
})

// ----- resolvePatternItems -----

describe('resolvePatternItems', () => {
  test('resolves empty array to empty array', () => {
    expect(resolvePatternItems([])).toEqual([])
  })

  test('resolves a valid system item', () => {
    const firstSystem = SalvageUnionReference.Systems.all()[0]!
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: firstSystem.id, sort_order: 0 },
    ]
    const resolved = resolvePatternItems(items)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.entity.id).toBe(firstSystem.id)
    expect(resolved[0]!.schema_name).toBe('systems')
    expect(resolved[0]!.sort_order).toBe(0)
  })

  test('resolves a valid module item', () => {
    const firstModule = SalvageUnionReference.Modules.all()[0]!
    const items: PatternItem[] = [
      { schema_name: 'modules', schema_ref_id: firstModule.id, sort_order: 0 },
    ]
    const resolved = resolvePatternItems(items)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.entity.id).toBe(firstModule.id)
    expect(resolved[0]!.schema_name).toBe('modules')
  })

  test('skips items with non-existent IDs', () => {
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'nonexistent-id', sort_order: 0 },
    ]
    const resolved = resolvePatternItems(items)
    expect(resolved).toHaveLength(0)
  })

  test('resolves mix of valid and invalid items', () => {
    const firstSystem = SalvageUnionReference.Systems.all()[0]!
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: firstSystem.id, sort_order: 0 },
      { schema_name: 'systems', schema_ref_id: 'nonexistent', sort_order: 1 },
      { schema_name: 'modules', schema_ref_id: 'also-nonexistent', sort_order: 2 },
    ]
    const resolved = resolvePatternItems(items)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.schema_ref_id).toBe(firstSystem.id)
  })

  test('preserves sort_order from input', () => {
    const systems = SalvageUnionReference.Systems.all()
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: systems[0]!.id, sort_order: 5 },
      { schema_name: 'systems', schema_ref_id: systems[1]!.id, sort_order: 10 },
    ]
    const resolved = resolvePatternItems(items)
    expect(resolved).toHaveLength(2)
    expect(resolved[0]!.sort_order).toBe(5)
    expect(resolved[1]!.sort_order).toBe(10)
  })

  test('resolved entity has slotsRequired property', () => {
    const firstSystem = SalvageUnionReference.Systems.all()[0]!
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: firstSystem.id, sort_order: 0 },
    ]
    const resolved = resolvePatternItems(items)
    expect(resolved[0]!.entity).toHaveProperty('slotsRequired')
    expect(typeof resolved[0]!.entity.slotsRequired).toBe('number')
  })

  test('resolves multiple systems and modules together', () => {
    const sys = SalvageUnionReference.Systems.all()
    const mod = SalvageUnionReference.Modules.all()
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 0 },
      { schema_name: 'systems', schema_ref_id: sys[1]!.id, sort_order: 1 },
      { schema_name: 'modules', schema_ref_id: mod[0]!.id, sort_order: 2 },
    ]
    const resolved = resolvePatternItems(items)
    expect(resolved).toHaveLength(3)
    expect(resolved.filter((r) => r.schema_name === 'systems')).toHaveLength(2)
    expect(resolved.filter((r) => r.schema_name === 'modules')).toHaveLength(1)
  })
})

// ----- Integration: computeCapacity with resolved real items -----

describe('computeCapacity with real game data', () => {
  test('real chassis + real systems calculates correctly', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const sys = SalvageUnionReference.Systems.all()

    // Pick a system and resolve it
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 0 },
    ]
    const resolved = resolvePatternItems(items)
    const capacity = computeCapacity(mule, resolved)

    expect(capacity.systemSlotsTotal).toBe(mule.systemSlots!)
    expect(capacity.systemSlotsUsed).toBe(sys[0]!.slotsRequired!)
    expect(capacity.moduleSlotsUsed).toBe(0)
  })

  test('overloading a real chassis triggers invalid', () => {
    // Find a chassis with small system slots
    const smallChassis = SalvageUnionReference.Chassis.all()
      .filter((c) => c.systemSlots! <= 4)
      .sort((a, b) => a.systemSlots! - b.systemSlots!)[0]!

    // Find systems that would exceed its capacity
    const bigSystems = SalvageUnionReference.Systems.all().filter(
      (s) => s.slotsRequired! > smallChassis.systemSlots!
    )

    if (bigSystems.length > 0) {
      const items: PatternItem[] = [
        { schema_name: 'systems', schema_ref_id: bigSystems[0]!.id, sort_order: 0 },
      ]
      const resolved = resolvePatternItems(items)
      const capacity = computeCapacity(smallChassis, resolved)
      expect(capacity.isOverSystemCapacity).toBe(true)
      expect(capacity.isValid).toBe(false)
    }
  })
})

// ----- patternToBuilderState -----

describe('patternToBuilderState', () => {
  test('converts a pattern row to builder state', () => {
    const pattern = {
      name: 'My Mech',
      chassis_ref: 'iron-mongrel',
      description: 'A description',
      visible: true,
      pattern_items: [{ schema_name: 'systems' as const, schema_ref_id: 'laser', sort_order: 0 }],
    }
    const state = patternToBuilderState(pattern)
    expect(state).toEqual({
      name: 'My Mech',
      chassisRef: 'iron-mongrel',
      description: 'A description',
      visible: true,
      customImageUrl: null,
      items: pattern.pattern_items,
    })
  })

  test('null description becomes empty string', () => {
    const pattern = {
      name: 'Test',
      chassis_ref: 'mule',
      description: null,
      visible: false,
      pattern_items: [],
    }
    const state = patternToBuilderState(pattern)
    expect(state.description).toBe('')
  })

  test('customImageUrl is always null', () => {
    const pattern = {
      name: 'Test',
      chassis_ref: 'mule',
      description: 'desc',
      visible: true,
      pattern_items: [],
    }
    const state = patternToBuilderState(pattern)
    expect(state.customImageUrl).toBeNull()
  })

  test('round-trips with builderToCreateInput', () => {
    const pattern = {
      name: 'Round Trip',
      chassis_ref: 'iron-mongrel',
      description: 'Test desc',
      visible: false,
      pattern_items: [
        { schema_name: 'systems' as const, schema_ref_id: 'a', sort_order: 0 },
        { schema_name: 'modules' as const, schema_ref_id: 'b', sort_order: 1 },
      ],
    }
    const state = patternToBuilderState(pattern)
    const output = builderToCreateInput(state)
    expect(output).not.toBeNull()
    expect(output!.name).toBe(pattern.name)
    expect(output!.chassis_ref).toBe(pattern.chassis_ref)
    expect(output!.description).toBe(pattern.description)
    expect(output!.visible).toBe(pattern.visible)
    expect(output!.pattern_items).toEqual(pattern.pattern_items)
  })
})

// ----- applyPatternItems -----

describe('applyPatternItems', () => {
  const baseState: BuilderState = {
    name: 'My Mech',
    chassisRef: 'iron-mongrel',
    description: 'A description',
    visible: true,
    customImageUrl: null,
    items: [
      { schema_name: 'systems', schema_ref_id: 'old-system', sort_order: 0 },
      { schema_name: 'modules', schema_ref_id: 'old-module', sort_order: 1 },
    ],
  }

  test('replaces all items with pattern items', () => {
    const patternItems: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'new-system-1', sort_order: 5 },
      { schema_name: 'systems', schema_ref_id: 'new-system-2', sort_order: 10 },
      { schema_name: 'modules', schema_ref_id: 'new-module-1', sort_order: 15 },
    ]
    const result = applyPatternItems(baseState, patternItems)
    expect(result.items).toHaveLength(3)
    expect(result.items[0]!.schema_ref_id).toBe('new-system-1')
    expect(result.items[1]!.schema_ref_id).toBe('new-system-2')
    expect(result.items[2]!.schema_ref_id).toBe('new-module-1')
  })

  test('re-indexes sort_order from 0', () => {
    const patternItems: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'a', sort_order: 99 },
      { schema_name: 'modules', schema_ref_id: 'b', sort_order: 200 },
    ]
    const result = applyPatternItems(baseState, patternItems)
    expect(result.items[0]!.sort_order).toBe(0)
    expect(result.items[1]!.sort_order).toBe(1)
  })

  test('preserves name, description, visible, chassisRef, customImageUrl', () => {
    const stateWithImage: BuilderState = {
      ...baseState,
      customImageUrl: 'blob:something',
    }
    const patternItems: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'new', sort_order: 0 },
    ]
    const result = applyPatternItems(stateWithImage, patternItems)
    expect(result.name).toBe('My Mech')
    expect(result.chassisRef).toBe('iron-mongrel')
    expect(result.description).toBe('A description')
    expect(result.visible).toBe(true)
    expect(result.customImageUrl).toBe('blob:something')
  })

  test('applying empty pattern clears all items', () => {
    const result = applyPatternItems(baseState, [])
    expect(result.items).toEqual([])
  })

  test('does not mutate original state', () => {
    const originalItems = [...baseState.items]
    applyPatternItems(baseState, [{ schema_name: 'systems', schema_ref_id: 'new', sort_order: 0 }])
    expect(baseState.items).toEqual(originalItems)
  })
})

// ----- patternItemsToOverride -----

describe('patternItemsToOverride', () => {
  test('returns empty arrays for empty items', () => {
    const result = patternItemsToOverride([])
    expect(result).toEqual({ systems: [], modules: [] })
  })

  test('resolves real system items to names', () => {
    const sys = SalvageUnionReference.Systems.all()
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 0 },
    ]
    const result = patternItemsToOverride(items)
    expect(result.systems).toHaveLength(1)
    expect(result.systems[0]!.name).toBe(sys[0]!.name)
    expect(result.modules).toHaveLength(0)
  })

  test('resolves real module items to names', () => {
    const mod = SalvageUnionReference.Modules.all()
    const items: PatternItem[] = [
      { schema_name: 'modules', schema_ref_id: mod[0]!.id, sort_order: 0 },
    ]
    const result = patternItemsToOverride(items)
    expect(result.modules).toHaveLength(1)
    expect(result.modules[0]!.name).toBe(mod[0]!.name)
    expect(result.systems).toHaveLength(0)
  })

  test('groups duplicate items with count', () => {
    const sys = SalvageUnionReference.Systems.all()
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 0 },
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 1 },
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 2 },
    ]
    const result = patternItemsToOverride(items)
    expect(result.systems).toHaveLength(1)
    expect(result.systems[0]!.name).toBe(sys[0]!.name)
    expect(result.systems[0]!.count).toBe(3)
  })

  test('single items do not have count property', () => {
    const sys = SalvageUnionReference.Systems.all()
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 0 },
    ]
    const result = patternItemsToOverride(items)
    expect(result.systems[0]!).not.toHaveProperty('count')
  })

  test('skips items with non-existent IDs', () => {
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: 'nonexistent', sort_order: 0 },
    ]
    const result = patternItemsToOverride(items)
    expect(result.systems).toHaveLength(0)
  })

  test('separates systems and modules correctly', () => {
    const sys = SalvageUnionReference.Systems.all()
    const mod = SalvageUnionReference.Modules.all()
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: sys[0]!.id, sort_order: 0 },
      { schema_name: 'systems', schema_ref_id: sys[1]!.id, sort_order: 1 },
      { schema_name: 'modules', schema_ref_id: mod[0]!.id, sort_order: 2 },
    ]
    const result = patternItemsToOverride(items)
    expect(result.systems).toHaveLength(2)
    expect(result.modules).toHaveLength(1)
  })
})

// ----- referencePatternToItems -----

describe('referencePatternToItems', () => {
  test('returns empty array for empty systems and modules', () => {
    expect(referencePatternToItems([], [])).toEqual([])
  })

  test('converts a single system by name to PatternItem', () => {
    const systemName = SalvageUnionReference.Systems.all()[0]!.name
    const systemId = SalvageUnionReference.Systems.all()[0]!.id
    const result = referencePatternToItems([{ name: systemName }], [])
    expect(result).toHaveLength(1)
    expect(result[0]!.schema_name).toBe('systems')
    expect(result[0]!.schema_ref_id).toBe(systemId)
    expect(result[0]!.sort_order).toBe(0)
  })

  test('converts a single module by name to PatternItem', () => {
    const moduleName = SalvageUnionReference.Modules.all()[0]!.name
    const moduleId = SalvageUnionReference.Modules.all()[0]!.id
    const result = referencePatternToItems([], [{ name: moduleName }])
    expect(result).toHaveLength(1)
    expect(result[0]!.schema_name).toBe('modules')
    expect(result[0]!.schema_ref_id).toBe(moduleId)
    expect(result[0]!.sort_order).toBe(0)
  })

  test('expands count into multiple PatternItems', () => {
    const systemName = SalvageUnionReference.Systems.all()[0]!.name
    const systemId = SalvageUnionReference.Systems.all()[0]!.id
    const result = referencePatternToItems([{ name: systemName, count: 3 }], [])
    expect(result).toHaveLength(3)
    for (const item of result) {
      expect(item.schema_name).toBe('systems')
      expect(item.schema_ref_id).toBe(systemId)
    }
    expect(result[0]!.sort_order).toBe(0)
    expect(result[1]!.sort_order).toBe(1)
    expect(result[2]!.sort_order).toBe(2)
  })

  test('skips systems with non-existent names', () => {
    const result = referencePatternToItems(
      [{ name: 'Totally Fake System That Does Not Exist' }],
      []
    )
    expect(result).toEqual([])
  })

  test('skips modules with non-existent names', () => {
    const result = referencePatternToItems(
      [],
      [{ name: 'Totally Fake Module That Does Not Exist' }]
    )
    expect(result).toEqual([])
  })

  test('systems come before modules in sort_order', () => {
    const systemName = SalvageUnionReference.Systems.all()[0]!.name
    const moduleName = SalvageUnionReference.Modules.all()[0]!.name
    const result = referencePatternToItems([{ name: systemName }], [{ name: moduleName }])
    expect(result).toHaveLength(2)
    expect(result[0]!.schema_name).toBe('systems')
    expect(result[0]!.sort_order).toBe(0)
    expect(result[1]!.schema_name).toBe('modules')
    expect(result[1]!.sort_order).toBe(1)
  })

  test('works with a real chassis pattern from reference data', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const hauler = mule.patterns!.find((p) => p.name === 'Hauler Pattern')!
    const result = referencePatternToItems(hauler.systems, hauler.modules)

    // Should have 7 systems + 2 modules = 9 total
    expect(result).toHaveLength(9)
    const systems = result.filter((r) => r.schema_name === 'systems')
    const modules = result.filter((r) => r.schema_name === 'modules')
    expect(systems).toHaveLength(7)
    expect(modules).toHaveLength(2)

    // sort_order should be contiguous 0..8
    const orders = result.map((r) => r.sort_order)
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  test('default count is 1 when count is omitted', () => {
    const systemName = SalvageUnionReference.Systems.all()[0]!.name
    const withCount = referencePatternToItems([{ name: systemName, count: 1 }], [])
    const withoutCount = referencePatternToItems([{ name: systemName }], [])
    expect(withCount).toEqual(withoutCount)
  })
})

// ----- Apply Pattern integration -----

describe('Apply Pattern pipeline (referencePatternToItems → applyPatternItems → resolve → capacity)', () => {
  test('applying Mule Hauler Pattern produces valid capacity', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const hauler = mule.patterns!.find((p) => p.name === 'Hauler Pattern')!

    // Step 1: Convert reference pattern to PatternItems
    const patternItems = referencePatternToItems(hauler.systems, hauler.modules)
    expect(patternItems.length).toBeGreaterThan(0)

    // Step 2: Apply to builder state
    const state: BuilderState = {
      name: 'Old Name',
      chassisRef: mule.id,
      description: '',
      visible: true,
      customImageUrl: null,
      items: [{ schema_name: 'systems', schema_ref_id: 'stale-item', sort_order: 0 }],
    }
    const applied = applyPatternItems(state, patternItems)
    expect(applied.items).toEqual(
      patternItems.map((item, i) => ({
        schema_name: item.schema_name,
        schema_ref_id: item.schema_ref_id,
        sort_order: i,
      }))
    )

    // Step 3: Resolve items to entities
    const resolved = resolvePatternItems(applied.items)
    expect(resolved).toHaveLength(patternItems.length)

    // Step 4: Verify capacity is valid for the Mule chassis
    const capacity = computeCapacity(mule, resolved)
    expect(capacity.isValid).toBe(true)
    expect(capacity.systemSlotsUsed).toBeLessThanOrEqual(capacity.systemSlotsTotal)
    expect(capacity.moduleSlotsUsed).toBeLessThanOrEqual(capacity.moduleSlotsTotal)
  })

  test('applying pattern replaces previous items completely', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const patterns = mule.patterns!
    expect(patterns.length).toBeGreaterThanOrEqual(2)

    // Apply first pattern
    const first = referencePatternToItems(patterns[0]!.systems, patterns[0]!.modules)
    const state: BuilderState = {
      name: 'Test',
      chassisRef: mule.id,
      description: '',
      visible: true,
      customImageUrl: null,
      items: [],
    }
    const afterFirst = applyPatternItems(state, first)
    expect(afterFirst.items).toHaveLength(first.length)

    // Apply second pattern — should fully replace
    const second = referencePatternToItems(patterns[1]!.systems, patterns[1]!.modules)
    const afterSecond = applyPatternItems(afterFirst, second)
    expect(afterSecond.items).toHaveLength(second.length)

    // All items should come from the second pattern
    const secondIds = new Set(second.map((i) => `${i.schema_name}:${i.schema_ref_id}`))
    for (const item of afterSecond.items) {
      const key = `${item.schema_name}:${item.schema_ref_id}`
      expect(secondIds.has(key)).toBe(true)
    }
  })

  test('round-trip: referencePatternToItems → patternItemsToOverride reconstructs names', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')!
    const hauler = mule.patterns!.find((p) => p.name === 'Hauler Pattern')!

    // Convert to PatternItems and back to override format
    const patternItems = referencePatternToItems(hauler.systems, hauler.modules)
    const override = patternItemsToOverride(patternItems)

    // Original system names should all appear in the override
    const originalSystemNames = hauler.systems.map((s) => s.name).sort()
    const overrideSystemNames = override.systems.map((s) => s.name).sort()
    expect(overrideSystemNames).toEqual(originalSystemNames)

    // Original module names should all appear in the override
    const originalModuleNames = hauler.modules.map((m) => m.name).sort()
    const overrideModuleNames = override.modules.map((m) => m.name).sort()
    expect(overrideModuleNames).toEqual(originalModuleNames)
  })

  test('all chassis patterns produce valid items (no unresolvable references)', () => {
    const allChassis = SalvageUnionReference.Chassis.all()
    for (const chassis of allChassis) {
      if (!chassis.patterns) continue
      for (const pattern of chassis.patterns) {
        const items = referencePatternToItems(pattern.systems, pattern.modules)
        const resolved = resolvePatternItems(items)
        // Every converted item should resolve — no name mismatches in reference data
        expect(resolved.length).toBe(items.length)
      }
    }
  })
})
