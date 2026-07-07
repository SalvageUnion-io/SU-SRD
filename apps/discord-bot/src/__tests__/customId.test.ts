/**
 * customId scheme tests — the stateless button plumbing behind "Roll again" /
 * "Roll on this table".
 *
 * The router (interactionCreate.test.ts) covers the happy dispatch; these pin
 * the encoding contract directly: the namespaced roundtrip, rejection of
 * foreign / malformed ids, and the 100-char cap that makes `rollAgainRow`
 * return null (an over-long-but-valid /su check expression must still roll —
 * just without a re-roll button).
 */
import { describe, expect, test } from 'bun:test'

import { buildCheckMessage } from '../commands/check.js'
import { makeCustomId, parseCustomId, rollAgainRow } from '../customId.js'

describe('makeCustomId / parseCustomId', () => {
  test('roundtrips a namespaced action + payload', () => {
    const id = makeCustomId('roll', 'Core Mechanic')
    expect(id).toBe('su:roll:Core Mechanic')
    expect(parseCustomId(id!)).toEqual({ action: 'roll', payload: 'Core Mechanic' })
  })

  test('preserves a payload that itself contains colons', () => {
    const id = makeCustomId('check', '2d6:weird')
    expect(parseCustomId(id!)).toEqual({ action: 'check', payload: '2d6:weird' })
  })

  test('rejects foreign and malformed ids', () => {
    expect(parseCustomId('someotherbot:thing')).toBeNull()
    expect(parseCustomId('su')).toBeNull()
    expect(parseCustomId('su:unknownaction:x')).toBeNull()
  })

  test('returns null when the id would exceed the 100-char cap', () => {
    const huge = 'x'.repeat(120)
    expect(makeCustomId('check', huge)).toBeNull()
    expect(rollAgainRow('check', huge, 'Roll again')).toBeNull()
  })
})

describe('rollAgainRow', () => {
  test('builds a single-button action row for a normal payload', () => {
    const row = rollAgainRow('roll', 'Core Mechanic', 'Roll again')
    expect(row).not.toBeNull()
    const json = row!.toJSON() as { components: { custom_id?: string; label?: string }[] }
    expect(json.components).toHaveLength(1)
    expect(json.components[0]!.custom_id).toBe('su:roll:Core Mechanic')
    // Label is prefixed with the ↻ repeat symbol (a typographic glyph, not an emoji).
    expect(json.components[0]!.label).toBe('↻ Roll again')
  })
})

describe('buildCheckMessage — over-cap notation', () => {
  test('a valid but over-long expression still rolls, but drops the re-roll button', () => {
    // Chain enough +1s to push `su:check:<notation>` past 100 chars while
    // staying valid randsum notation.
    const notation = `1d20${'+1'.repeat(48)}`
    expect(notation.length).toBeGreaterThan(91)
    const message = buildCheckMessage(notation)
    expect('error' in message).toBe(false)
    if ('error' in message) return
    expect(message.embeds).toHaveLength(1)
    // customId would exceed the cap, so no button rides along.
    expect(message.components).toHaveLength(0)
  })
})
