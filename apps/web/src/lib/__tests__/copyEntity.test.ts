import { describe, expect, test } from 'bun:test'
import { containerOf } from 'game-domain/container'
import { FIXTURE_NOW } from '../../components/__tests__/fixtures'
import { copyForShelf, copyName } from '../copyEntity'

/**
 * Copying an entity onto your shelf (ADR-030 §2).
 *
 * The properties worth pinning are all about what a copy does NOT keep. A copy
 * that carried its id would be a duplicate `appId` — the exact condition that
 * took a play session down — and a copy that carried its container would follow
 * the source back into the Game it was explicitly copied out of.
 */

const SOURCE = {
  id: 'source-uuid',
  schemaVersion: 1,
  name: 'Babe',
  callsign: 'Babe',
  classRef: 'salvager',
  gameId: 'game-123',
  createdAt: FIXTURE_NOW,
  updatedAt: '2026-02-02T00:00:00.000Z',
  conditions: ['injured'],
  abilities: [],
  equipment: [],
}

describe('copyForShelf', () => {
  test('lands on the shelf even when the source was in a game', () => {
    const copy = copyForShelf(SOURCE, 'Pilot')

    // `null`, not absent. An absent `gameId` would let `entityStore.create`
    // stamp whatever container is open — for a copy made from a Game roster,
    // the Game it just came out of.
    expect(copy.gameId).toBeNull()
    expect(containerOf(copy).kind).toBe('shelf')
  })

  test('keeps its name where the shelf has none like it, and is numbered where it has (r3 L5)', () => {
    expect(copyForShelf(SOURCE, 'Pilot').name).toBe('Babe')
    expect(copyForShelf(SOURCE, 'Pilot', ['Babe']).name).toBe('Babe 2')
  })

  test('keeps no identity from the source', () => {
    const copy = copyForShelf(SOURCE, 'Pilot')

    // replica/records.ts mints these on create. Carrying `id` through would produce a
    // second row claiming to be the original — a duplicate appId by hand.
    expect(copy.id).toBeUndefined()
    expect(copy.createdAt).toBeUndefined()
    expect(copy.updatedAt).toBeUndefined()
  })

  test('copies the body verbatim otherwise', () => {
    const copy = copyForShelf(SOURCE, 'Pilot')

    // A copy of a character mid-campaign IS that character mid-campaign.
    // Starting fresh is what the wizard is for.
    expect(copy.conditions).toEqual(['injured'])
    expect(copy.classRef).toBe('salvager')
    expect(copy.callsign).toBe('Babe')
  })

  test('falls back rather than leaving a copy nameless', () => {
    expect(copyForShelf({ ...SOURCE, name: '' }, 'Pilot').name).toBe('Pilot')
    expect(copyForShelf({ ...SOURCE, name: undefined }, 'Mech').name).toBe('Mech')
  })

  test('does not mutate the source', () => {
    const source = { ...SOURCE }
    copyForShelf(source, 'Pilot')

    // The Game roster hands this its live row body; mutating it would rewrite
    // the crewmate's name on screen.
    expect(source.name).toBe('Babe')
    expect(source.id).toBe('source-uuid')
    expect(source.gameId).toBe('game-123')
  })

  test('a copy of a copy is named once: the next number, never a copy of a copy (r3 L5)', () => {
    const once = copyForShelf(SOURCE, 'Pilot', ['Babe'])
    const twice = copyForShelf(once, 'Pilot', ['Babe', 'Babe 2'])

    expect(once.name).toBe('Babe 2')
    expect(twice.name).toBe('Babe 3')
  })
})

describe('copyName', () => {
  test('a name the shelf does not have is kept', () => {
    expect(copyName('Reaper')).toBe('Reaper')
  })

  test('a second copy is numbered, so no two rows read alike', () => {
    expect(copyName('Leaky', ['Leaky'])).toBe('Leaky 2')
    expect(copyName('Leaky', ['Leaky', 'Leaky 2'])).toBe('Leaky 3')
    expect(copyName('Leaky 2', ['Leaky', 'Leaky 2'])).toBe('Leaky 3')
    expect(copyForShelf({ name: 'Leaky' }, 'Leaky', ['Leaky']).name).toBe('Leaky 2')
  })

  test('a number that is part of the name stays', () => {
    expect(copyName('Unit 7', ['Unit 7'])).toBe('Unit 7 2')
  })
})

describe('a Mech’s copy starts fresh (r8 E5)', () => {
  test('undamaged, at full EP and 0 Heat, with no conditions; its build stays', async () => {
    const { freshMechCopy } = await import('../copyEntity')
    const copy = freshMechCopy({
      name: 'Tab B 2',
      systems: ['red-laser'],
      currentSP: 10,
      currentEP: 3,
      currentHeat: 2,
      systemConditions: { 'red-laser': 'damaged' },
      moduleConditions: {},
      conditions: ['Vulnerable'],
    })
    expect(copy).toEqual({ name: 'Tab B 2', systems: ['red-laser'], conditions: [] })
  })
})
