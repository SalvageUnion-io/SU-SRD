/**
 * customId scheme tests — the stateless button plumbing behind "Roll again" /
 * "Roll on this table".
 *
 * The router (interactionCreate.test.ts) covers the happy dispatch; these pin
 * the encoding contract directly: the namespaced roundtrip, rejection of
 * foreign / malformed ids, and the 100-char cap that makes `makeCustomId`
 * return null (an over-long payload must still render — just without a
 * re-roll button).
 */
import { describe, expect, test } from 'bun:test'
import { makeCustomId, parseCustomId } from '../customId.js'

describe('makeCustomId / parseCustomId', () => {
  test('roundtrips a namespaced action + payload', () => {
    const id = makeCustomId('roll', 'Core Mechanic')
    expect(id).toBe('su:roll:Core Mechanic')
    if (!id) throw new Error('expected a customId')
    expect(parseCustomId(id)).toEqual({ action: 'roll', payload: 'Core Mechanic' })
  })

  test('preserves a payload that itself contains colons', () => {
    const id = makeCustomId('roll', 'Odd: Table')
    if (!id) throw new Error('expected a customId')
    expect(parseCustomId(id)).toEqual({ action: 'roll', payload: 'Odd: Table' })
  })

  test('roundtrips the lookup action (the "See table" button)', () => {
    const id = makeCustomId('lookup', 'Core Mechanic')
    expect(id).toBe('su:lookup:Core Mechanic')
    if (!id) throw new Error('expected a customId')
    expect(parseCustomId(id)).toEqual({ action: 'lookup', payload: 'Core Mechanic' })
  })

  test('rejects foreign and malformed ids', () => {
    expect(parseCustomId('someotherbot:thing')).toBeNull()
    expect(parseCustomId('su')).toBeNull()
    expect(parseCustomId('su:unknownaction:x')).toBeNull()
  })

  test('returns null when the id would exceed the 100-char cap', () => {
    const huge = 'x'.repeat(120)
    expect(makeCustomId('roll', huge)).toBeNull()
  })
})
