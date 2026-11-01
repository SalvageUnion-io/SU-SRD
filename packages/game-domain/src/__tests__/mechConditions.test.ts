import { describe, expect, test } from 'bun:test'
import { foldMechFlags, hasCondition, storedMechConditions, withCondition } from '../mechConditions'
import { parseUnit } from '../ops/applyOp'

describe('mech conditions', () => {
  test('a label reads in any case', () => {
    expect(hasCondition([' vulnerable '], 'Vulnerable')).toBe(true)
    expect(hasCondition(['Prone'], 'Vulnerable')).toBe(false)
  })

  test('turning a label on adds it once; off removes every spelling', () => {
    expect(withCondition(['Prone'], 'Shutdown', true)).toEqual(['Prone', 'Shutdown'])
    expect(withCondition(['shutdown'], 'Shutdown', true)).toEqual(['shutdown'])
    expect(withCondition(['Prone', 'shutdown', 'Shutdown'], 'Shutdown', false)).toEqual(['Prone'])
  })

  test('a stored body reads its legacy true flags as labels, deduplicated', () => {
    expect(
      storedMechConditions({
        conditions: ['Prone', 'vulnerable', 7],
        shutdown: true,
        vulnerable: true,
        destroyed: false,
      })
    ).toEqual(['Prone', 'vulnerable', 'Shutdown'])
    expect(storedMechConditions({})).toEqual([])
  })

  test('folding moves the flags onto the list and drops them', () => {
    expect(foldMechFlags({ conditions: [], destroyed: true, shutdown: false })).toEqual({
      conditions: ['Destroyed'],
    })
    const plain = { conditions: ['Burn (2)'] }
    expect(foldMechFlags(plain)).toBe(plain)
  })

  test('a stored mech saved with the flags parses with them as conditions', () => {
    const parsed = parseUnit('mech', {
      id: 'm1',
      schemaVersion: 1,
      name: 'Old Faithful',
      chassisRef: 'mule-chassis',
      systems: [],
      modules: [],
      cargoLots: [],
      conditions: ['Prone'],
      shutdown: true,
      vulnerable: true,
      destroyed: false,
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.conditions).toEqual(['Prone', 'Shutdown', 'Vulnerable'])
    expect(parsed.data && 'shutdown' in parsed.data).toBe(false)
  })
})
