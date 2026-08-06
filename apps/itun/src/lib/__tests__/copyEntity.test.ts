import { describe, expect, test } from 'bun:test'
import { containerOf } from '../container'
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-02T00:00:00.000Z',
  conditions: ['injured'],
  abilities: [],
  equipment: [],
}

describe('copyForShelf', () => {
  test('lands on the shelf even when the source was in a game', () => {
    const copy = copyForShelf(SOURCE, 'Pilot')

    // `null`, not absent. `undefined` would mean "not decided", which sends it
    // through the legacy fallback AND lets `entityStore.create` stamp whatever
    // container is open — for a copy made from a Game roster, the Game it just
    // came out of.
    expect(copy.gameId).toBeNull()
    expect(containerOf(copy).kind).toBe('shelf')
  })

  test('announces itself as a copy', () => {
    expect(copyForShelf(SOURCE, 'Pilot').name).toBe('COPY OF Babe')
  })

  test('keeps no identity from the source', () => {
    const copy = copyForShelf(SOURCE, 'Pilot')

    // The db layer mints these on create. Carrying `id` through would produce a
    // second row claiming to be the original — a duplicate appId by hand.
    expect(copy.id).toBeUndefined()
    expect(copy.createdAt).toBeUndefined()
    expect(copy.updatedAt).toBeUndefined()
  })

  test('drops a legacy workspaceId rather than carrying it', () => {
    // `containerOf` still reads `workspaceId` as a pre-ADR-030 fallback, so a
    // stale one riding along could resolve the copy back into a Game.
    const copy = copyForShelf({ ...SOURCE, gameId: undefined, workspaceId: 'ws-9' }, 'Pilot')

    expect(copy.workspaceId).toBeUndefined()
    expect(containerOf(copy).kind).toBe('shelf')
  })

  test('copies the body verbatim otherwise', () => {
    const copy = copyForShelf(SOURCE, 'Pilot')

    // A copy of a character mid-campaign IS that character mid-campaign.
    // Starting fresh is what the wizard is for.
    expect(copy.conditions).toEqual(['injured'])
    expect(copy.classRef).toBe('salvager')
    expect(copy.callsign).toBe('Babe')
  })

  test('falls back rather than naming something COPY OF nothing', () => {
    expect(copyForShelf({ ...SOURCE, name: '' }, 'Pilot').name).toBe('COPY OF Pilot')
    expect(copyForShelf({ ...SOURCE, name: undefined }, 'Mech').name).toBe('COPY OF Mech')
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

  test('a copy of a copy is honest about it', () => {
    const once = copyForShelf(SOURCE, 'Pilot')
    const twice = copyForShelf(once, 'Pilot')

    expect(twice.name).toBe('COPY OF COPY OF Babe')
  })
})

describe('copyName', () => {
  test('prefixes rather than suffixes', () => {
    // Prefixed so a copy never sorts next to the original and gets mistaken
    // for it in a list.
    expect(copyName('Reaper')).toBe('COPY OF Reaper')
  })
})
