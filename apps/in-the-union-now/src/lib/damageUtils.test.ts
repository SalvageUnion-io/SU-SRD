import { describe, test, expect } from 'bun:test'
import {
  computeDamageCascade,
  selectRandomTarget,
  filterDamageableRefs,
} from './damageUtils'
import type { EntityRefRow } from '../types/common'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const testUserId = 'user-abc'
const testMechId = 'mech-abc'

function makeRef(overrides: Partial<EntityRefRow> = {}): EntityRefRow {
  return {
    id: 'ref-1',
    parent_id: testMechId,
    parent_type: 'mech',
    schema_name: 'systems',
    schema_ref_id: 'sys-1',
    sort_order: 0,
    condition: 'intact',
    metadata: null,
    user_id: testUserId,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeDamageCascade
// ---------------------------------------------------------------------------

describe('computeDamageCascade', () => {
  describe('SP damage that does not reach 0', () => {
    test('returns correct newSp when damage is less than currentSp', () => {
      const result = computeDamageCascade(10, 3, false)
      expect(result.newSp).toBe(7)
    })

    test('returns hpDamage as floor(damage / 2) when boarded', () => {
      // damage 3 → hpDamage 1 (floor(3/2) = 1)
      const result = computeDamageCascade(10, 3, true)
      expect(result.hpDamage).toBe(1)
    })

    test('returns hpDamage 0 for damage of 1 when boarded', () => {
      // damage 1 → hpDamage 0 (floor(1/2) = 0)
      const result = computeDamageCascade(10, 1, true)
      expect(result.hpDamage).toBe(0)
    })

    test('does not trigger critical when SP > 0', () => {
      const result = computeDamageCascade(10, 3, false)
      expect(result.triggersCritical).toBe(false)
    })

    test('hpDamage is only applied when boarded', () => {
      const boardedResult = computeDamageCascade(10, 4, true)
      const unboardedResult = computeDamageCascade(10, 4, false)
      // hpDamage is non-zero only when boarded
      expect(boardedResult.hpDamage).toBe(2)
      expect(unboardedResult.hpDamage).toBe(0)
    })
  })

  describe('SP damage that reaches exactly 0', () => {
    test('returns newSp of 0 when damage equals currentSp', () => {
      const result = computeDamageCascade(5, 5, false)
      expect(result.newSp).toBe(0)
    })

    test('triggers critical when newSp reaches 0', () => {
      const result = computeDamageCascade(5, 5, false)
      expect(result.triggersCritical).toBe(true)
    })
  })

  describe('SP damage that exceeds currentSp (overkill)', () => {
    test('clamps newSp to 0', () => {
      const result = computeDamageCascade(3, 10, false)
      expect(result.newSp).toBe(0)
    })

    test('triggers critical on overkill', () => {
      const result = computeDamageCascade(3, 10, false)
      expect(result.triggersCritical).toBe(true)
    })

    test('hpDamage is based on input damage, not clamped', () => {
      // hpDamage = floor(10 / 2) = 5, not based on actual SP reduction
      const result = computeDamageCascade(3, 10, true)
      expect(result.hpDamage).toBe(5)
    })
  })

  describe('edge cases', () => {
    test('damage of 0 produces no change', () => {
      const result = computeDamageCascade(8, 0, false)
      expect(result.newSp).toBe(8)
      expect(result.hpDamage).toBe(0)
      expect(result.triggersCritical).toBe(false)
    })

    test('currentSp of 0 with any damage still returns triggersCritical', () => {
      const result = computeDamageCascade(0, 1, false)
      expect(result.newSp).toBe(0)
      expect(result.triggersCritical).toBe(true)
    })

    test('even damage produces exact half hpDamage', () => {
      const result = computeDamageCascade(20, 6, true)
      expect(result.hpDamage).toBe(3)
    })

    test('odd damage produces floor hpDamage', () => {
      const result = computeDamageCascade(20, 7, true)
      expect(result.hpDamage).toBe(3)
    })
  })
})

// ---------------------------------------------------------------------------
// filterDamageableRefs
// ---------------------------------------------------------------------------

describe('filterDamageableRefs', () => {
  test('includes systems refs that are not destroyed', () => {
    const refs = [
      makeRef({ id: 'ref-1', schema_name: 'systems', condition: 'intact' }),
      makeRef({ id: 'ref-2', schema_name: 'systems', condition: 'damaged' }),
    ]
    const result = filterDamageableRefs(refs)
    expect(result).toHaveLength(2)
  })

  test('includes modules refs that are not destroyed', () => {
    const refs = [
      makeRef({ id: 'ref-3', schema_name: 'modules', condition: 'intact' }),
    ]
    const result = filterDamageableRefs(refs)
    expect(result).toHaveLength(1)
  })

  test('excludes destroyed refs', () => {
    const refs = [
      makeRef({ id: 'ref-1', schema_name: 'systems', condition: 'intact' }),
      makeRef({ id: 'ref-2', schema_name: 'systems', condition: 'destroyed' }),
    ]
    const result = filterDamageableRefs(refs)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('ref-1')
  })

  test('excludes non-system and non-module refs', () => {
    const refs = [
      makeRef({ id: 'ref-1', schema_name: 'systems', condition: 'intact' }),
      makeRef({ id: 'ref-2', schema_name: 'abilities', condition: 'intact' }),
      makeRef({ id: 'ref-3', schema_name: 'equipment', condition: 'intact' }),
    ]
    const result = filterDamageableRefs(refs)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('ref-1')
  })

  test('returns empty array when all refs are destroyed', () => {
    const refs = [
      makeRef({ id: 'ref-1', schema_name: 'systems', condition: 'destroyed' }),
      makeRef({ id: 'ref-2', schema_name: 'modules', condition: 'destroyed' }),
    ]
    const result = filterDamageableRefs(refs)
    expect(result).toHaveLength(0)
  })

  test('returns empty array for empty input', () => {
    expect(filterDamageableRefs([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// selectRandomTarget
// ---------------------------------------------------------------------------

describe('selectRandomTarget', () => {
  test('returns a ref from the list', () => {
    const refs = [
      makeRef({ id: 'ref-1' }),
      makeRef({ id: 'ref-2' }),
      makeRef({ id: 'ref-3' }),
    ]
    const result = selectRandomTarget(refs)
    expect(result).not.toBeNull()
    const ids = refs.map((r) => r.id)
    expect(ids).toContain(result!.id)
  })

  test('returns the single item when list has one element', () => {
    const refs = [makeRef({ id: 'ref-only' })]
    const result = selectRandomTarget(refs)
    expect(result!.id).toBe('ref-only')
  })

  test('returns null for empty list', () => {
    const result = selectRandomTarget([])
    expect(result).toBeNull()
  })

  test('returns a ref with valid id (not undefined)', () => {
    const refs = [makeRef({ id: 'ref-a' }), makeRef({ id: 'ref-b' })]
    const result = selectRandomTarget(refs)
    expect(result!.id).toBeDefined()
    expect(typeof result!.id).toBe('string')
  })
})
