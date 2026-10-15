import { describe, expect, test } from 'bun:test'
import { MechPatternSchema } from 'cantina-domain/schemas/pattern'
import type { SoftLink } from 'cantina-domain/schemas/softLink'
import {
  crawlerFixture,
  FIXTURE_NOW,
  mechFixture,
  pilotFixture,
} from '../../../components/__tests__/fixtures'
import {
  chassisFact,
  containerChip,
  crawlerChips,
  crawlerIsKept,
  crawlerReading,
  linkChip,
  mechChips,
  npcChips,
  patternChips,
  patternReading,
  pilotChips,
  shownUnder,
} from '../shelfItems'

/**
 * What an item on Shelves says (board S1): where it is, what is
 * linked to it, where it came from, and for a pattern who can see it.
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

describe('the Showing toggle', () => {
  test('Everything shows a unit in a Game; Not in a Game does not', () => {
    expect(shownUnder('everything', { gameId: 'g1' })).toBe(true)
    expect(shownUnder('not-in-game', { gameId: 'g1' })).toBe(false)
    expect(shownUnder('not-in-game', { gameId: null })).toBe(true)
    expect(shownUnder('not-in-game', {})).toBe(true)
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

describe('where it is', () => {
  test('GAME | its name, a hollow "Unassigned", or just "In a Game" when it cannot be named', () => {
    expect(containerChip({ gameId: 'g1' }, GAMES)).toEqual({
      key: 'where',
      label: 'Game',
      value: 'Reclamation of the Wastes',
    })
    expect(containerChip({ gameId: null }, GAMES)).toEqual({
      key: 'where',
      label: 'Unassigned',
      hollow: true,
    })
    expect(containerChip({ gameId: 'gone' }, GAMES).label).toBe('In a Game')
    expect(containerChip({ gameId: 'g1' }, undefined).label).toBe('In a Game')
  })
})

describe('a unit’s chips', () => {
  test('a pilot names its Game and its mech, never where it came from', () => {
    const pilot = pilotFixture({ id: 'p1', gameId: 'g1', seedRef: 'starter-pilot-bonesaw' })
    expect(
      chipLabels(
        pilotChips({
          pilot,
          games: GAMES,
          softLinks: [LINK],
          mechNames: new Map([['m1', 'Scrapper']]),
        })
      )
    ).toEqual(['Game | Reclamation of the Wastes', 'Assigned: Scrapper'])
  })

  test('a mech names its pilot, never the pattern it was built from', () => {
    const mech = mechFixture({ id: 'm1', gameId: null, sourcePattern: 'pat-tow-rig' })
    expect(
      chipLabels(
        mechChips({
          mech,
          games: GAMES,
          softLinks: [LINK],
          pilotNames: new Map([['p1', 'Bonesaw']]),
        })
      )
    ).toEqual(['Unassigned', 'Pilot: Bonesaw'])
  })

  test('a crawler in a Game you mediate says so; in one you only play, it does not', () => {
    expect(
      chipLabels(
        crawlerChips({ crawler: crawlerFixture({ id: 'c1', gameId: 'g2' }), games: GAMES })
      )
    ).toEqual(['Game | Dustbowl Run', 'You mediate'])
    expect(
      chipLabels(
        crawlerChips({ crawler: crawlerFixture({ id: 'c1', gameId: 'g1' }), games: GAMES })
      )
    ).toEqual(['Game | Reclamation of the Wastes'])
  })
})

describe('shared by link', () => {
  test('a pilot, mech or crawler anyone with the link may read says so', () => {
    expect(chipLabels(linkChip(['p1'], 'p1'))).toEqual(['Shared by link'])
    expect(linkChip(['p1'], 'p2')).toEqual([])
    expect(linkChip(undefined, 'p1')).toEqual([])
  })

  test('an NPC says who can see it: by link first, else where it is', () => {
    const shelf = { gameId: null }
    const inGame = { gameId: 'g1' }
    expect(chipLabels(npcChips({ npc: shelf, games: GAMES }))).toEqual(['Only me'])
    expect(chipLabels(npcChips({ npc: inGame, games: GAMES }))).toEqual([
      'Shared with Reclamation of the Wastes',
    ])
    expect(chipLabels(npcChips({ npc: shelf, games: GAMES, sharedByLink: true }))).toEqual([
      'Shared by link',
    ])
    expect(chipLabels(npcChips({ npc: inGame, games: GAMES, sharedByLink: true }))).toEqual([
      'Shared by link',
    ])
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
