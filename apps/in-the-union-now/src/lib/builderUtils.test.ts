import { describe, expect, test } from 'bun:test'
import type { SURefChassis, SURefSystem, SURefModule } from 'salvageunion-reference'
import type { PatternItem } from '../types/common'
import type { BuilderState, ResolvedItem } from './builderUtils'
import { computeCapacity, nextSortOrder, builderToCreateInput } from './builderUtils'

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

describe('computeCapacity', () => {
  test('returns zeros when chassis is null', () => {
    const result = computeCapacity(null, [])
    expect(result.systemSlotsUsed).toBe(0)
    expect(result.systemSlotsTotal).toBe(0)
    expect(result.moduleSlotsUsed).toBe(0)
    expect(result.moduleSlotsTotal).toBe(0)
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
})

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
})

describe('builderToCreateInput', () => {
  test('returns null when name is empty', () => {
    const state: BuilderState = {
      name: '',
      chassisRef: 'iron-mongrel',
      description: '',
      visible: true,
      items: [],
    }
    expect(builderToCreateInput(state)).toBeNull()
  })

  test('returns null when chassisRef is null', () => {
    const state: BuilderState = {
      name: 'My Pattern',
      chassisRef: null,
      description: '',
      visible: true,
      items: [],
    }
    expect(builderToCreateInput(state)).toBeNull()
  })

  test('returns valid input for valid state', () => {
    const state: BuilderState = {
      name: '  My Pattern  ',
      chassisRef: 'iron-mongrel',
      description: 'A test pattern',
      visible: true,
      items: [{ schema_name: 'systems', schema_ref_id: 'laser', sort_order: 0 }],
    }
    const result = builderToCreateInput(state)
    expect(result).toEqual({
      name: 'My Pattern',
      chassis_ref: 'iron-mongrel',
      description: 'A test pattern',
      visible: true,
      pattern_items: state.items,
    })
  })

  test('omits description when empty', () => {
    const state: BuilderState = {
      name: 'My Pattern',
      chassisRef: 'iron-mongrel',
      description: '  ',
      visible: true,
      items: [],
    }
    const result = builderToCreateInput(state)
    expect(result?.description).toBeUndefined()
  })
})
