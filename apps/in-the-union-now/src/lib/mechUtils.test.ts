import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'
import {
  computeMechStatsFromChassis,
  computeMechStatsFromRef,
  patternItemsToEntityRefs,
  entityRefsToBuilderState,
  builderStateToPatchOps,
} from './mechUtils'
import type { PatternItem, EntityRefRow, MechRow } from '../types/common'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const ironMongrel = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')! as SURefChassis

const firstSystem = SalvageUnionReference.Systems.all()[0]!
const firstModule = SalvageUnionReference.Modules.all()[0]!

const testUserId = 'test-user-id'
const testMechId = 'test-mech-id'

// ---------------------------------------------------------------------------
// computeMechStatsFromChassis
// ---------------------------------------------------------------------------

describe('computeMechStatsFromChassis', () => {
  test('returns stats from Iron Mongrel chassis', () => {
    const stats = computeMechStatsFromChassis(ironMongrel)
    expect(stats.max_sp).toBe(ironMongrel.structurePoints ?? 0)
    expect(stats.max_ep).toBe(ironMongrel.energyPoints ?? 0)
    expect(stats.heat_capacity).toBe(ironMongrel.heatCapacity ?? 0)
    expect(stats.cargo_capacity).toBe(ironMongrel.cargoCapacity ?? 0)
  })

  test('all stats are numbers', () => {
    const stats = computeMechStatsFromChassis(ironMongrel)
    expect(typeof stats.max_sp).toBe('number')
    expect(typeof stats.max_ep).toBe('number')
    expect(typeof stats.heat_capacity).toBe('number')
    expect(typeof stats.cargo_capacity).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// computeMechStatsFromRef
// ---------------------------------------------------------------------------

describe('computeMechStatsFromRef', () => {
  test('returns stats for valid chassis ref', () => {
    const stats = computeMechStatsFromRef(ironMongrel.id)
    expect(stats).not.toBeNull()
    expect(stats!.max_sp).toBe(ironMongrel.structurePoints ?? 0)
  })

  test('returns null for invalid chassis ref', () => {
    const stats = computeMechStatsFromRef('nonexistent-id')
    expect(stats).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// patternItemsToEntityRefs
// ---------------------------------------------------------------------------

describe('patternItemsToEntityRefs', () => {
  test('converts pattern items to entity ref inserts', () => {
    const items: PatternItem[] = [
      { schema_name: 'systems', schema_ref_id: firstSystem.id, sort_order: 0 },
      { schema_name: 'modules', schema_ref_id: firstModule.id, sort_order: 1 },
    ]
    const refs = patternItemsToEntityRefs(testMechId, testUserId, items)
    expect(refs).toHaveLength(2)
    expect(refs[0]!.parent_id).toBe(testMechId)
    expect(refs[0]!.parent_type).toBe('mech')
    expect(refs[0]!.schema_name).toBe('systems')
    expect(refs[0]!.schema_ref_id).toBe(firstSystem.id)
    expect(refs[0]!.user_id).toBe(testUserId)
    expect(refs[1]!.schema_name).toBe('modules')
  })

  test('returns empty array for empty items', () => {
    expect(patternItemsToEntityRefs(testMechId, testUserId, [])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// entityRefsToBuilderState
// ---------------------------------------------------------------------------

describe('entityRefsToBuilderState', () => {
  const mockMech: MechRow = {
    id: testMechId,
    user_id: testUserId,
    chassis_ref: ironMongrel.id,
    pattern_name: 'Test Pattern',
    active: true,
    max_sp: 10,
    current_sp: 10,
    max_ep: 8,
    current_ep: 8,
    heat_capacity: 6,
    current_heat: 0,
    cargo_capacity: 4,
    image_path: null,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  }

  const mockRefs: EntityRefRow[] = [
    {
      id: 'ref-1',
      parent_id: testMechId,
      parent_type: 'mech',
      schema_name: 'systems',
      schema_ref_id: firstSystem.id,
      sort_order: 0,
      condition: 'intact',
      metadata: null,
      user_id: testUserId,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: 'ref-2',
      parent_id: testMechId,
      parent_type: 'mech',
      schema_name: 'modules',
      schema_ref_id: firstModule.id,
      sort_order: 1,
      condition: 'intact',
      metadata: null,
      user_id: testUserId,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ]

  test('converts mech + refs to BuilderState', () => {
    const state = entityRefsToBuilderState(mockMech, mockRefs)
    expect(state.name).toBe('Test Pattern')
    expect(state.chassisRef).toBe(ironMongrel.id)
    expect(state.items).toHaveLength(2)
    expect(state.items[0]!.schema_name).toBe('systems')
    expect(state.items[1]!.schema_name).toBe('modules')
  })

  test('filters out non-system/module refs', () => {
    const refsWithAbility: EntityRefRow[] = [
      ...mockRefs,
      {
        id: 'ref-3',
        parent_id: testMechId,
        parent_type: 'mech',
        schema_name: 'abilities',
        schema_ref_id: 'some-ability',
        sort_order: 2,
        condition: 'intact',
        metadata: null,
        user_id: testUserId,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ]
    const state = entityRefsToBuilderState(mockMech, refsWithAbility)
    expect(state.items).toHaveLength(2) // ability filtered out
  })

  test('sorts items by sort_order', () => {
    const unsortedRefs: EntityRefRow[] = [mockRefs[1]!, mockRefs[0]!]
    const state = entityRefsToBuilderState(mockMech, unsortedRefs)
    expect(state.items[0]!.sort_order).toBeLessThan(state.items[1]!.sort_order)
  })
})

// ---------------------------------------------------------------------------
// builderStateToPatchOps
// ---------------------------------------------------------------------------

describe('builderStateToPatchOps', () => {
  const oldRefs: EntityRefRow[] = [
    {
      id: 'ref-1',
      parent_id: testMechId,
      parent_type: 'mech',
      schema_name: 'systems',
      schema_ref_id: 'sys-a',
      sort_order: 0,
      condition: 'intact',
      metadata: null,
      user_id: testUserId,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: 'ref-2',
      parent_id: testMechId,
      parent_type: 'mech',
      schema_name: 'modules',
      schema_ref_id: 'mod-a',
      sort_order: 1,
      condition: 'intact',
      metadata: null,
      user_id: testUserId,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ]

  test('no changes produces empty ops', () => {
    const newState = {
      name: '',
      chassisRef: ironMongrel.id,
      description: '',
      visible: true,
      customImageUrl: null,
      items: [
        { schema_name: 'systems' as const, schema_ref_id: 'sys-a', sort_order: 0 },
        { schema_name: 'modules' as const, schema_ref_id: 'mod-a', sort_order: 1 },
      ],
    }
    const ops = builderStateToPatchOps(oldRefs, newState, testMechId, testUserId)
    expect(ops.deleteIds).toHaveLength(0)
    expect(ops.inserts).toHaveLength(0)
  })

  test('removing an item produces a delete', () => {
    const newState = {
      name: '',
      chassisRef: ironMongrel.id,
      description: '',
      visible: true,
      customImageUrl: null,
      items: [{ schema_name: 'systems' as const, schema_ref_id: 'sys-a', sort_order: 0 }],
    }
    const ops = builderStateToPatchOps(oldRefs, newState, testMechId, testUserId)
    expect(ops.deleteIds).toContain('ref-2')
  })

  test('adding an item produces an insert', () => {
    const newState = {
      name: '',
      chassisRef: ironMongrel.id,
      description: '',
      visible: true,
      customImageUrl: null,
      items: [
        { schema_name: 'systems' as const, schema_ref_id: 'sys-a', sort_order: 0 },
        { schema_name: 'modules' as const, schema_ref_id: 'mod-a', sort_order: 1 },
        { schema_name: 'systems' as const, schema_ref_id: 'sys-b', sort_order: 2 },
      ],
    }
    const ops = builderStateToPatchOps(oldRefs, newState, testMechId, testUserId)
    expect(ops.inserts).toHaveLength(1)
    expect(ops.inserts[0]!.schema_ref_id).toBe('sys-b')
    expect(ops.deleteIds).toHaveLength(0)
  })
})
