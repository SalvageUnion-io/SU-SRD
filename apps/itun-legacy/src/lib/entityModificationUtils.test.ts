import { describe, expect, test } from 'bun:test'
import {
  hasModificationSlots,
  isSlotOwnerRef,
  getSlotOwnerRefs,
  resolveBuiltInSystems,
  computeSlotCapacity,
  slotOwnerMetadata,
  resolvePlayerItems,
} from './entityModificationUtils'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntityRefRow } from '../types/common'

function makeRef(overrides: Partial<EntityRefRow> = {}): EntityRefRow {
  return {
    id: 'ref-1',
    parent_id: 'mech-1',
    parent_type: 'mech',
    schema_name: 'systems',
    schema_ref_id: 'sys-1',
    sort_order: 0,
    condition: 'intact',
    metadata: null,
    user_id: 'user-1',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('hasModificationSlots', () => {
  test('returns true for entity with systemSlots > 0', () => {
    expect(hasModificationSlots({ systemSlots: 3, moduleSlots: 0 })).toBe(true)
  })

  test('returns true for entity with moduleSlots > 0', () => {
    expect(hasModificationSlots({ systemSlots: 0, moduleSlots: 2 })).toBe(true)
  })

  test('returns false for entity with no slots', () => {
    expect(hasModificationSlots({ systemSlots: 0, moduleSlots: 0 })).toBe(false)
  })

  test('returns false for entity with missing slot fields', () => {
    expect(hasModificationSlots({ name: 'Test' })).toBe(false)
  })

  test('returns true for Sestra Drone from game data', () => {
    const sestra = SalvageUnionReference.Drones.find((d) => d.name === 'Sestra Drone')
    expect(sestra).toBeDefined()
    expect(hasModificationSlots(sestra!)).toBe(true)
  })
})

describe('isSlotOwnerRef', () => {
  test('returns true when metadata has slot_owner_ref string', () => {
    expect(isSlotOwnerRef(makeRef({ metadata: { slot_owner_ref: 'drone-123' } }))).toBe(true)
  })

  test('returns false when metadata is null', () => {
    expect(isSlotOwnerRef(makeRef({ metadata: null }))).toBe(false)
  })

  test('returns false when metadata has no slot_owner_ref', () => {
    expect(isSlotOwnerRef(makeRef({ metadata: { other: 'value' } }))).toBe(false)
  })

  test('returns false when slot_owner_ref is not a string', () => {
    expect(isSlotOwnerRef(makeRef({ metadata: { slot_owner_ref: 42 } }))).toBe(false)
  })
})

describe('getSlotOwnerRefs', () => {
  const ownerId = 'drone-abc'

  test('filters refs belonging to specific owner', () => {
    const refs = [
      makeRef({ id: '1', schema_name: 'systems', metadata: { slot_owner_ref: ownerId } }),
      makeRef({ id: '2', schema_name: 'modules', metadata: { slot_owner_ref: ownerId } }),
      makeRef({ id: '3', schema_name: 'systems', metadata: null }), // regular mech system
      makeRef({ id: '4', schema_name: 'systems', metadata: { slot_owner_ref: 'other-drone' } }),
    ]
    const result = getSlotOwnerRefs(refs, ownerId)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  test('returns empty array when no matching refs', () => {
    const refs = [makeRef({ id: '1', schema_name: 'systems', metadata: null })]
    expect(getSlotOwnerRefs(refs, ownerId)).toHaveLength(0)
  })

  test('excludes non-system/module schema_names', () => {
    const refs = [
      makeRef({ id: '1', schema_name: 'abilities', metadata: { slot_owner_ref: ownerId } }),
    ]
    expect(getSlotOwnerRefs(refs, ownerId)).toHaveLength(0)
  })
})

describe('resolveBuiltInSystems', () => {
  test('resolves drone built-in systems by name', () => {
    const sestra = SalvageUnionReference.Drones.find((d) => d.name === 'Sestra Drone')!
    const builtIn = resolveBuiltInSystems(sestra)
    expect(builtIn.length).toBeGreaterThan(0)
    expect(builtIn[0]!.entity.name).toBe('Hover Locomotion System')
    expect(builtIn[0]!.schema_name).toBe('systems')
  })

  test('uses negative sort_order for built-in items', () => {
    const sestra = SalvageUnionReference.Drones.find((d) => d.name === 'Sestra Drone')!
    const builtIn = resolveBuiltInSystems(sestra)
    for (const item of builtIn) {
      expect(item.sort_order).toBeLessThan(0)
    }
  })

  test('returns empty for entity without systems field', () => {
    const ability = SalvageUnionReference.Abilities.all()[0]!
    expect(resolveBuiltInSystems(ability)).toHaveLength(0)
  })
})

describe('computeSlotCapacity', () => {
  test('does not count built-in (integrated) systems toward slots used', () => {
    const sestra = SalvageUnionReference.Drones.find((d) => d.name === 'Sestra Drone')!
    const builtIn = resolveBuiltInSystems(sestra)
    const capacity = computeSlotCapacity(sestra, builtIn, [])

    expect(capacity.systemSlotsTotal).toBe(7)
    expect(capacity.moduleSlotsTotal).toBe(2)
    expect(capacity.systemSlotsUsed).toBe(0)
    expect(capacity.isValid).toBe(true)
  })

  test('marks over-capacity correctly', () => {
    const sestra = SalvageUnionReference.Drones.find((d) => d.name === 'Sestra Drone')!
    const hoverSystem = SalvageUnionReference.Systems.find(
      (s) => s.name === 'Hover Locomotion System'
    )!
    // Add enough systems to exceed 7 slots (hover is 5 slots each)
    const playerItems = [
      {
        schema_name: 'systems' as const,
        schema_ref_id: hoverSystem.id,
        sort_order: 0,
        entity: hoverSystem,
      },
      {
        schema_name: 'systems' as const,
        schema_ref_id: hoverSystem.id,
        sort_order: 1,
        entity: hoverSystem,
      },
    ]

    const capacity = computeSlotCapacity(sestra, [], playerItems)
    expect(capacity.isOverSystemCapacity).toBe(true)
    expect(capacity.isValid).toBe(false)
  })
})

describe('slotOwnerMetadata', () => {
  test('returns correct metadata shape', () => {
    const meta = slotOwnerMetadata('drone-xyz')
    expect(meta).toEqual({ slot_owner_ref: 'drone-xyz' })
  })
})

describe('resolvePlayerItems', () => {
  test('resolves refs to ResolvedItems', () => {
    const hoverSystem = SalvageUnionReference.Systems.find(
      (s) => s.name === 'Hover Locomotion System'
    )!
    const refs = [
      makeRef({
        schema_name: 'systems',
        schema_ref_id: hoverSystem.id,
        sort_order: 5,
        metadata: { slot_owner_ref: 'drone-1' },
      }),
    ]
    const resolved = resolvePlayerItems(refs)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.entity.name).toBe('Hover Locomotion System')
    expect(resolved[0]!.sort_order).toBe(5)
  })

  test('skips refs with unknown schema_ref_id', () => {
    const refs = [makeRef({ schema_name: 'systems', schema_ref_id: 'nonexistent-id' })]
    expect(resolvePlayerItems(refs)).toHaveLength(0)
  })
})
