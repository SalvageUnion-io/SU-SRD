import { describe, expect, test } from 'bun:test'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { crawlerFixture, FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import {
  chassisFact,
  crawlerChips,
  crawlerReading,
  crewLinked,
  gameRelation,
  linkChip,
  npcChips,
  patternChips,
  patternReading,
} from '../shelfItems'

/**
 * What an item in the Training Bay says: the Game it is in, what is
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

describe('a unit’s crew link', () => {
  test('a pilot’s mech is a Mini of its own kind, opening its sheet', () => {
    expect(
      crewLinked({
        kind: 'pilot',
        id: 'p1',
        softLinks: [LINK],
        names: new Map([['m1', 'Scrapper']]),
      })
    ).toEqual([{ key: 'mech:m1', kind: 'mech', name: 'Scrapper', href: '/mechs/m1', readings: [] }])
  })

  test('a mech’s pilot is a Mini of its own kind', () => {
    expect(
      crewLinked({ kind: 'mech', id: 'm1', softLinks: [LINK], names: new Map([['p1', 'Bonesaw']]) })
    ).toMatchObject([{ kind: 'pilot', name: 'Bonesaw', href: '/pilots/p1' }])
  })

  test('a linked unit carries its own stat chips onto its Mini', () => {
    const SP = [{ label: 'SP', value: '9/13' }]
    const [mech] = crewLinked({
      kind: 'pilot',
      id: 'p1',
      softLinks: [LINK],
      names: new Map([['m1', 'Scrapper']]),
      readings: new Map([['m1', SP]]),
    })
    expect(mech?.readings).toEqual(SP)
  })

  test('an unlinked unit, or one whose partner cannot be named, has none', () => {
    expect(crewLinked({ kind: 'mech', id: 'm1', softLinks: [], names: new Map() })).toEqual([])
    expect(crewLinked({ kind: 'mech', id: 'm1', softLinks: [LINK], names: new Map() })).toEqual([])
  })
})

describe('a crawler’s chips', () => {
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
    const base = { appId: 'p', gameId: null, builtCount: 0 }
    const games = [{ _id: 'g1', name: 'Dustbowl Run', mediator: false }]
    const crew = { ...base, visibility: 'game' as const, gameId: 'g1' }
    expect(chipLabels(patternChips({ ...base, visibility: 'private' }, games))).toEqual(['Only me'])
    expect(chipLabels(patternChips({ ...base, visibility: 'link', builtCount: 2 }, games))).toEqual(
      ['Shared by link']
    )
    expect(chipLabels(patternChips(crew, games))).toEqual(['Shared with Dustbowl Run'])
    expect(patternChips(undefined, games)).toEqual([])
  })

  test('a crew share names its Game from the player’s own, and reaches nobody once they left it', () => {
    const crew = { appId: 'p', visibility: 'game' as const, gameId: 'g1', builtCount: 0 }
    expect(chipLabels(patternChips(crew, undefined))).toEqual(['Shared with a crew'])
    expect(chipLabels(patternChips(crew, []))).toEqual(['Only me'])
  })
})

describe('the line', () => {
  test('the stamp reads what it is, never its kind', () => {
    expect(chassisFact('scrapper')).toBe('Scrapper')
  })

  test('a crawler reads its tech level; a pattern how full its system slots are', () => {
    expect(crawlerReading({ techLevel: 1 })).toEqual({ label: 'TL', value: '1' })
    const towRig = MechPatternSchema.parse({
      id: 'pat-tow-rig',
      schemaVersion: 1,
      name: 'Tow Rig',
      chassisRef: 'scrapper',
      systems: [],
      modules: [],
      createdAt: FIXTURE_NOW,
    })
    expect(patternReading(towRig)?.label).toBe('SYS')
    expect(patternReading(towRig)?.value).toMatch(/^0\/\d+$/)
  })
})
