import { describe, expect, test } from 'bun:test'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { crawlerFixture, FIXTURE_NOW, mechFixture } from '../../../components/__tests__/fixtures'
import {
  chassisFact,
  crawlerChips,
  crawlerIsKept,
  crawlerReading,
  gameRelation,
  linkChip,
  mechRelations,
  npcChips,
  patternChips,
  patternReading,
  pilotRelations,
  shelfFilters,
  shownUnder,
} from '../shelfItems'

/**
 * What an item in the Hangar says (board S1): the Game it is in, what is
 * linked to it, and for a pattern or NPC who can see it.
 */

const GAMES = [
  { _id: 'g1', name: 'Reclamation of the Wastes', mediator: false },
  { _id: 'g2', name: 'Dustbowl Run', mediator: true },
]

const LINK: SoftLink = {
  id: 'l1',
  from: { type: 'mech', id: 'm1' },
  to: { type: 'pilot', id: 'p1' },
  type: 'mech-to-pilot',
  createdAt: FIXTURE_NOW,
} as SoftLink

const chipLabels = (chips: { label: string; value?: string }[]) =>
  chips.map((c) => (c.value ? `${c.label} | ${c.value}` : c.label))

describe('the Showing select', () => {
  test('Everything, Not in a Game, then one entry per Game', () => {
    expect(shelfFilters(GAMES)).toEqual([
      { value: 'everything', label: 'Everything' },
      { value: 'not-in-game', label: 'Not in a Game' },
      { value: 'game:g1', label: 'Reclamation of the Wastes' },
      { value: 'game:g2', label: 'Dustbowl Run' },
    ])
    expect(shelfFilters(undefined).map((f) => f.value)).toEqual(['everything', 'not-in-game'])
  })

  test('Everything shows a unit in a Game; Not in a Game does not; a Game shows its own', () => {
    expect(shownUnder('everything', { gameId: 'g1' })).toBe(true)
    expect(shownUnder('not-in-game', { gameId: 'g1' })).toBe(false)
    expect(shownUnder('not-in-game', { gameId: null })).toBe(true)
    expect(shownUnder('not-in-game', {})).toBe(true)
    expect(shownUnder('game:g1', { gameId: 'g1' })).toBe(true)
    expect(shownUnder('game:g1', { gameId: 'g2' })).toBe(false)
    expect(shownUnder('game:g1', { gameId: null })).toBe(false)
  })
})

describe('which crawlers are yours to keep', () => {
  const RUNS = [
    { _id: 'g1', name: 'Reclamation of the Wastes', mediator: false, tableRunner: false },
    { _id: 'g2', name: 'Dustbowl Run', mediator: true, tableRunner: true },
  ]
  test('on the shelf, or in a Game you run — not the crew’s crawler at a table you play at', () => {
    expect(crawlerIsKept({ gameId: null }, RUNS)).toBe(true)
    expect(crawlerIsKept({ gameId: 'g2' }, RUNS)).toBe(true)
    expect(crawlerIsKept({ gameId: 'g1' }, RUNS)).toBe(false)
  })

  test('with no Game list to ask, nothing is hidden', () => {
    expect(crawlerIsKept({ gameId: 'g1' }, undefined)).toBe(true)
    expect(crawlerIsKept({ gameId: 'left' }, RUNS)).toBe(true)
  })
})

describe('its Game', () => {
  test('GAME | its name, a relation opening the Game’s page in Play', () => {
    expect(gameRelation({ gameId: 'g1' }, GAMES)).toEqual([
      {
        key: 'game',
        label: 'Game',
        value: 'Reclamation of the Wastes',
        href: '/play/games/g1',
      },
    ])
  })

  test('in no Game the lane stays empty: never an "Unassigned" chip', () => {
    expect(gameRelation({ gameId: null }, GAMES)).toEqual([])
    expect(gameRelation({}, GAMES)).toEqual([])
  })

  test('a Game it cannot name still links, as "A Game"', () => {
    expect(gameRelation({ gameId: 'gone' }, GAMES)[0]?.value).toBe('A Game')
    expect(gameRelation({ gameId: 'g1' }, undefined)[0]).toMatchObject({
      value: 'A Game',
      href: '/play/games/g1',
    })
  })
})

describe('a unit’s relations', () => {
  test('a pilot’s mech is a relation', () => {
    expect(
      pilotRelations({
        pilot: { id: 'p1' },
        softLinks: [LINK],
        mechNames: new Map([['m1', 'Scrapper']]),
      })
    ).toEqual([{ key: 'mech', label: 'Mech', value: 'Scrapper', href: '/sheet/mech/m1' }])
  })

  test('a mech’s pilot is a relation', () => {
    const mech = mechFixture({ id: 'm1', gameId: null, sourcePattern: 'pat-tow-rig' })
    expect(
      mechRelations({ mech, softLinks: [LINK], pilotNames: new Map([['p1', 'Bonesaw']]) })
    ).toEqual([{ key: 'pilot', label: 'Pilot', value: 'Bonesaw', href: '/sheet/pilot/p1' }])
  })

  test('an unlinked unit, or one whose partner cannot be named, has no relation', () => {
    const mech = mechFixture({ id: 'm1' })
    expect(mechRelations({ mech, softLinks: [], pilotNames: new Map() })).toEqual([])
    expect(mechRelations({ mech, softLinks: [LINK], pilotNames: new Map() })).toEqual([])
  })

  test('a crawler in a Game you mediate says so; in one you only play, it does not', () => {
    expect(
      chipLabels(
        crawlerChips({ crawler: crawlerFixture({ id: 'c1', gameId: 'g2' }), games: GAMES })
      )
    ).toEqual(['You mediate'])
    expect(
      chipLabels(
        crawlerChips({ crawler: crawlerFixture({ id: 'c1', gameId: 'g1' }), games: GAMES })
      )
    ).toEqual([])
  })
})

describe('shared by link', () => {
  test('a pilot, mech or crawler anyone with the link may read says so', () => {
    expect(chipLabels(linkChip(['p1'], 'p1'))).toEqual(['Shared by link'])
    expect(linkChip(['p1'], 'p2')).toEqual([])
    expect(linkChip(undefined, 'p1')).toEqual([])
  })

  test('an NPC says who can see it: by link first, else only you; in a Game its relation says', () => {
    const shelf = { gameId: null }
    const inGame = { gameId: 'g1' }
    expect(chipLabels(npcChips({ npc: shelf }))).toEqual(['Only me'])
    expect(npcChips({ npc: inGame })).toEqual([])
    expect(chipLabels(npcChips({ npc: shelf, sharedByLink: true }))).toEqual(['Shared by link'])
    expect(chipLabels(npcChips({ npc: inGame, sharedByLink: true }))).toEqual(['Shared by link'])
  })
})

describe('a pattern’s chips', () => {
  test('who can see it, never how often it has been built', () => {
    const base = { appId: 'p', gameName: null, builtCount: 0 }
    expect(chipLabels(patternChips({ ...base, visibility: 'private' }))).toEqual(['Only me'])
    expect(chipLabels(patternChips({ ...base, visibility: 'link', builtCount: 2 }))).toEqual([
      'Shared by link',
    ])
    expect(
      chipLabels(patternChips({ ...base, visibility: 'game', gameName: 'Dustbowl Run' }))
    ).toEqual(['Shared with Dustbowl Run'])
    expect(patternChips(undefined)).toEqual([])
  })
})

describe('the line', () => {
  test('the stamp reads what it is, never its kind', () => {
    expect(chassisFact('scrapper')).toBe('Scrapper')
  })

  test('a crawler reads its tech level; a pattern how full its system slots are', () => {
    expect(crawlerReading({ techLevel: 'Tech 1' })).toEqual({ label: 'TL', value: '1' })
    const towRig = MechPatternSchema.parse({
      id: 'pat-tow-rig',
      schemaVersion: 1,
      name: 'Tow Rig',
      chassisRef: 'scrapper',
      systems: [],
      modules: [],
      cargoLots: [],
      createdAt: FIXTURE_NOW,
    })
    expect(patternReading(towRig)?.label).toBe('SYS')
    expect(patternReading(towRig)?.value).toMatch(/^0\/\d+$/)
  })
})
