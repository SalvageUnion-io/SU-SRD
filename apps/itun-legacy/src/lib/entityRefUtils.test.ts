import { describe, test, expect } from 'bun:test'
import { abilityToEntityRef, equipmentToEntityRefs } from './entityRefUtils'

const testUserId = 'test-user-id'
const testPilotId = 'test-pilot-id'

describe('abilityToEntityRef', () => {
  test('creates pilot ability ref with sort_order 0', () => {
    const ref = abilityToEntityRef(testPilotId, testUserId, {
      schema_name: 'abilities',
      schema_ref_id: 'ability-id',
    })
    expect(ref.parent_id).toBe(testPilotId)
    expect(ref.parent_type).toBe('pilot')
    expect(ref.schema_name).toBe('abilities')
    expect(ref.sort_order).toBe(0)
  })
})

describe('equipmentToEntityRefs', () => {
  test('creates equipment refs with sequential sort_order starting at 1', () => {
    const refs = equipmentToEntityRefs(testPilotId, testUserId, [
      { schema_name: 'equipment', schema_ref_id: 'eq-1' },
      { schema_name: 'equipment', schema_ref_id: 'eq-2' },
    ])
    expect(refs).toHaveLength(2)
    expect(refs[0]!.sort_order).toBe(1)
    expect(refs[1]!.sort_order).toBe(2)
    expect(refs[0]!.parent_type).toBe('pilot')
  })
})
