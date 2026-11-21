/**
 * `parseFrozenEntity`: a body somebody else's browser wrote is read through
 * its kind's schema, and one that does not read comes back as a reason to
 * show, never a throw mid-sheet.
 */

import { describe, expect, test } from 'bun:test'
import {
  crawlerFixture,
  mechFixture,
  npcFixture,
  pilotFixture,
} from '../../../components/__tests__/fixtures'
import { parseFrozenEntity } from '../frozenEntity'

describe('parseFrozenEntity', () => {
  test('reads each kind through its own schema', () => {
    const cases = [
      ['pilot', pilotFixture({ id: 'p1' })],
      ['mech', mechFixture({ id: 'm1' })],
      ['crawler', crawlerFixture({ id: 'c1' })],
      ['npc', npcFixture({ id: 'n1' })],
    ] as const
    for (const [kind, body] of cases) {
      const parsed = parseFrozenEntity(kind, body)
      expect(parsed).toMatchObject({ ok: true, kind, entity: { id: body.id } })
    }
  })

  test('a body that is no record is missing, whatever kind it claims', () => {
    for (const body of [null, undefined, 'pilot', 7, [pilotFixture({ id: 'p1' })]]) {
      expect(parseFrozenEntity('pilot', body)).toEqual({
        ok: false,
        reason: 'Entity data is missing or invalid.',
      })
    }
  })

  test('a body its schema refuses says which kind, with the schema’s own words', () => {
    for (const [kind, label] of [
      ['pilot', 'Pilot'],
      ['mech', 'Mech'],
      ['crawler', 'crawler'],
      ['npc', 'NPC'],
    ] as const) {
      const parsed = parseFrozenEntity(kind, { id: 7 })
      expect(parsed.ok).toBe(false)
      expect(parsed.ok === false && parsed.reason).toStartWith(`Invalid ${label} data: `)
    }
  })

  test('a kind the app does not know is named', () => {
    expect(parseFrozenEntity('vehicle', { id: 'v1' })).toEqual({
      ok: false,
      reason: 'Unknown entity kind: vehicle',
    })
    expect(parseFrozenEntity(undefined, { id: 'v1' })).toEqual({
      ok: false,
      reason: 'Unknown entity kind: undefined',
    })
  })
})
