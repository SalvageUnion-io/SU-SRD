import { describe, expect, test } from 'bun:test'
import { FIXTURE_NOW, npcFixture } from '../../../components/__tests__/fixtures'
import type { LibraryItem, LibraryRow } from '../library'
import { itemHref, libraryItem, npcLibraryCopy, shownItems } from '../library'

const PATTERN: LibraryRow = {
  kind: 'pattern',
  appId: 'pat-0a1b2c3d4e5f6789',
  body: {
    id: 'pat-0a1b2c3d4e5f6789',
    schemaVersion: 1,
    name: 'Tow Rig',
    chassisRef: 'scrapper',
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
  },
  madeBy: 'Rosa',
  listedAt: 2,
  mine: false,
}

const NPC: LibraryRow = {
  kind: 'npc',
  appId: 'npc-1',
  body: { ...npcFixture({ id: 'npc-1', name: 'Old Mags' }), position: 'Medic' },
  madeBy: 'Ash',
  listedAt: 1,
  mine: true,
}

const items = [PATTERN, NPC].map(libraryItem).filter((i): i is LibraryItem => i !== null)

describe('the Homebrew library, as the client reads it', () => {
  test('parses a pattern with its chassis and an NPC, and drops what does not parse', () => {
    expect(items.map((i) => i.kind)).toEqual(['pattern', 'npc'])
    expect(libraryItem({ ...PATTERN, body: { name: 'broken' } })).toBeNull()
    expect(
      libraryItem({ ...PATTERN, body: { ...(PATTERN.body as object), chassisRef: 'nope' } })
    ).toBeNull()
  })

  test('opens each on its public page', () => {
    expect(items.map(itemHref)).toEqual([`/p/pattern/${PATTERN.appId}`, '/p/npc/npc-1'])
  })

  test('filters by kind and searches names, makers and what it is built on', () => {
    const names = (filter: 'all' | 'pattern' | 'npc', search: string) =>
      shownItems(items, filter, search).map((i) => i.appId)
    expect(names('all', '')).toEqual([PATTERN.appId, 'npc-1'])
    expect(names('npc', '')).toEqual(['npc-1'])
    expect(names('all', 'rosa')).toEqual([PATTERN.appId])
    expect(names('all', 'scrap')).toEqual([PATTERN.appId])
    expect(names('all', 'MEDIC')).toEqual(['npc-1'])
    expect(names('pattern', 'medic')).toEqual([])
  })

  test('a copied NPC is new, on the shelf, at full HP, and keeps its name', () => {
    const item = items[1]
    if (item?.kind !== 'npc') throw new Error('expected the NPC')
    const copy = npcLibraryCopy({ ...item.npc, currentHP: 1 })
    expect(copy.id).toBeUndefined()
    expect(copy.gameId).toBeNull()
    expect(copy.name).toBe('Old Mags')
    expect(copy.currentHP).toBe(item.npc.hitPoints)
  })
})
