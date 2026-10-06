import { describe, expect, test } from 'bun:test'
import type { GameMember } from '../gameRoster'
import {
  crawlerRows,
  isTableRunner,
  moveDestinations,
  ownableRows,
  tableCapabilities,
} from '../gameRoster'

/**
 * The Game roster's rules, tested against the same cases as the server.
 *
 * These assertions intentionally read like `convex/__tests__/tableSetup.test.ts`
 * — that is the point. This module exists so the surface can hide what the
 * server would refuse, and the only way that stays true is for both to be
 * pinned to the same table of cases. If one of these ever has to change without
 * its server twin changing, the surface has started lying.
 */

const MEDIATOR: GameMember = {
  userId: 'u-med',
  displayName: 'Mediator',
  mediator: true,
  organizer: false,
}
const ORGANIZER: GameMember = {
  userId: 'u-org',
  displayName: 'Organizer',
  mediator: false,
  organizer: true,
}
const PLAYER: GameMember = {
  userId: 'u-play',
  displayName: 'Player',
  mediator: false,
  organizer: false,
}

const ALL = [MEDIATOR, ORGANIZER, PLAYER]

describe('who runs the table', () => {
  test('the Mediator does', () => {
    expect(isTableRunner('u-med', ALL)).toBe(true)
  })

  test('a player does not', () => {
    expect(isTableRunner('u-play', ALL)).toBe(false)
  })

  test('the Organizer does only while nobody mediates', () => {
    expect(isTableRunner('u-org', ALL)).toBe(false)
    // A brand-new Game is exactly this shape: one member, organizer, no
    // Mediator. Without the fallback nobody could raise its first crawler.
    expect(isTableRunner('u-org', [ORGANIZER, PLAYER])).toBe(true)
  })

  test('a signed-out viewer never does', () => {
    expect(isTableRunner(null, ALL)).toBe(false)
  })

  test('somebody who is not in the game never does', () => {
    expect(isTableRunner('u-stranger', ALL)).toBe(false)
  })
})

describe('what the game will accept', () => {
  test('a player adds crew before any crawler exists — the gate is gone (ADR-037)', () => {
    const caps = tableCapabilities({ viewerId: 'u-play', members: ALL, crawlerCount: 0 })
    expect(caps.canAddCrew).toBe(true)
    expect(caps.addCrewBlocked).toBeNull()
    expect(caps.canRaiseCrawler).toBe(false)
  })

  test('somebody not at the table adds nothing, and is told why', () => {
    const caps = tableCapabilities({ viewerId: 'u-stranger', members: ALL, crawlerCount: 1 })
    expect(caps.canAddCrew).toBe(false)
    // A refusal with no reason reads as a broken button.
    expect(caps.addCrewBlocked).toMatch(/members/i)
  })

  test('the table runner is exempt, or a new game could never be set up', () => {
    const caps = tableCapabilities({ viewerId: 'u-med', members: ALL, crawlerCount: 0 })
    expect(caps.canAddCrew).toBe(true)
    expect(caps.canRaiseCrawler).toBe(true)
    expect(caps.canOfferUnclaimed).toBe(true)
  })

  test('only the table runner may leave a character unclaimed', () => {
    const caps = tableCapabilities({ viewerId: 'u-play', members: ALL, crawlerCount: 1 })
    expect(caps.canOfferUnclaimed).toBe(false)
  })
})

describe('rows carry ownership as a state, never a blank', () => {
  const rows = [
    { _id: 's1', appId: 'a1', ownerId: 'u-play', body: { name: 'Roach-Boy' } },
    { _id: 's2', appId: null, ownerId: null, body: { name: 'Pre-gen' } },
    { _id: 's3', appId: 'a3', ownerId: 'u-med', body: { name: "Someone else's" } },
  ]

  const built = (viewerId: string | null, localIds: string[] = []) =>
    ownableRows({
      kind: 'pilot',
      rows,
      viewerId,
      members: ALL,
      localIds: new Set(localIds),
    })

  test('an unclaimed pilot reads as Unclaimed and offers a pick-up', () => {
    const [, pregen] = built('u-play')
    expect(pregen?.owner?.label).toBe('Unclaimed')
    expect(pregen?.can.claim).toBe(true)
  })

  test("a crewmate's pilot is neither claimable nor openable", () => {
    const [, , theirs] = built('u-play')
    expect(theirs?.owner?.label).toBe('Mediator')
    expect(theirs?.can.claim).toBe(false)
    // The sheet is a live editing surface; opening one whose writes the server
    // refuses would be worse than not linking it.
    expect(theirs?.can.openSheet).toBe(false)
  })

  test('your own reads as You, opens, and can be handed back', () => {
    const [mine] = built('u-play')
    expect(mine?.owner?.label).toBe('You')
    expect(mine?.can.openSheet).toBe(true)
    expect(mine?.can.release).toBe(true)
  })

  test('localId is set only when this browser actually holds a copy', () => {
    expect(built('u-play')[0]?.localId).toBeNull()
    expect(built('u-play', ['a1'])[0]?.localId).toBe('a1')
  })

  test('a body with no name still renders something', () => {
    const [row] = ownableRows({
      kind: 'mech',
      rows: [{ _id: 's9', appId: null, ownerId: null, body: {} }],
      viewerId: 'u-play',
      members: ALL,
      localIds: new Set(),
    })
    expect(row?.name).toBe('Mech')
  })
})

describe('deleting from a game', () => {
  const rows = [
    { _id: 's1', appId: 'a1', ownerId: 'u-play', body: { name: 'Roach-Boy' } },
    { _id: 's2', appId: null, ownerId: null, body: { name: 'Pre-gen' } },
    { _id: 's3', appId: 'a3', ownerId: 'u-med', body: { name: "Someone else's" } },
  ]

  const built = (viewerId: string | null) =>
    ownableRows({ kind: 'pilot', rows, viewerId, members: ALL, localIds: new Set() })

  test('the owner may delete their own', () => {
    // A Game had no delete at all before this — only "Offer to the crew", which
    // hands a character over rather than ending it. The reported version was
    // blunter: "u can't delete pilots or mechs".
    const [mine] = built('u-play')
    expect(mine?.can.delete).toBe(true)
  })

  test("nobody may delete a crewmate's, or an unclaimed pre-gen", () => {
    const [, pregen, theirs] = built('u-play')
    // Mirrors `assertMayWrite`: an unclaimed row has no owner to be, and
    // somebody else's is theirs. Both refuse on the server, so neither offers.
    expect(pregen?.can.delete).toBe(false)
    expect(theirs?.can.delete).toBe(false)
  })

  test('delete is not release — a row that can do one can do both', () => {
    // They are separate verbs on purpose: releasing is generous and reversible,
    // deleting is neither. A surface that collapsed them would guess wrong in
    // the one direction that cannot be undone.
    const [mine] = built('u-play')
    expect(mine?.can.release).toBe(true)
    expect(mine?.can.delete).toBe(true)
  })
})

describe('crawler rows are communal', () => {
  const rows = [{ _id: 'c1', appId: 'ca1', body: { name: '#430 Tenacity' } }]

  test('every member may open one — that is what communal means', () => {
    const [row] = crawlerRows({ rows, tableRunner: false, localIds: new Set() })
    expect(row?.can.openSheet).toBe(true)
    // No owner chip at all: "who owns the crawler" is not a question with an
    // answer, and rendering "Unclaimed" would invite somebody to claim it.
    expect(row?.owner).toBeNull()
    expect(row?.can.claim).toBe(false)
  })

  test('the primary is marked, and only the table runner may make another one primary', () => {
    const two = [...rows, { _id: 'c2', appId: 'c2', body: { name: 'Second' } }]
    const asRunner = crawlerRows({
      rows: two,
      tableRunner: true,
      localIds: new Set(),
      primaryCrawlerId: two[0]?._id ?? null,
    })
    expect(asRunner.map((r) => r.primary)).toEqual([true, false])
    // Already primary: nothing to make.
    expect(asRunner.map((r) => r.can.makePrimary)).toEqual([false, true])

    const asPlayer = crawlerRows({ rows: two, tableRunner: false, localIds: new Set() })
    expect(asPlayer.every((r) => !r.can.makePrimary)).toBe(true)
  })

  test('only the table runner may scrap one', () => {
    expect(crawlerRows({ rows, tableRunner: false, localIds: new Set() })[0]?.can.scrap).toBe(false)
    expect(crawlerRows({ rows, tableRunner: true, localIds: new Set() })[0]?.can.scrap).toBe(true)
  })

  test('and scrapping is the only way to destroy one', () => {
    // No second delete verb beside Scrap: it would be the same destruction
    // under a name the rules do not use, and for the table runner alone either
    // way.
    for (const tableRunner of [false, true]) {
      expect(crawlerRows({ rows, tableRunner, localIds: new Set() })[0]?.can.delete).toBe(false)
    }
  })
})

describe('moveDestinations — the move control lists only what the server accepts', () => {
  const games = [
    { _id: 'g1', name: 'Run by me', tableRunner: true },
    { _id: 'g2', name: 'Run by someone else', tableRunner: false },
  ]
  const labels = (d: ReturnType<typeof moveDestinations>) => d.map((x) => x.label)

  test('a pilot or mech may go to the shelf or any Game I belong to', () => {
    expect(labels(moveDestinations({ kind: 'pilot', current: { kind: 'shelf' }, games }))).toEqual([
      'Shelf',
      'Run by me',
      'Run by someone else',
    ])
    expect(
      labels(moveDestinations({ kind: 'mech', current: { kind: 'game', gameId: 'g2' }, games }))
    ).toEqual(['Run by someone else', 'Shelf', 'Run by me'])
  })

  test('a shelf crawler may go only into a Game I run', () => {
    expect(
      labels(moveDestinations({ kind: 'crawler', current: { kind: 'shelf' }, games }))
    ).toEqual(['Shelf', 'Run by me'])
  })

  test('a Game crawler may come out to my shelf only if I run that Game — never Game to Game', () => {
    expect(
      labels(moveDestinations({ kind: 'crawler', current: { kind: 'game', gameId: 'g1' }, games }))
    ).toEqual(['Run by me', 'Shelf'])
    expect(
      labels(moveDestinations({ kind: 'crawler', current: { kind: 'game', gameId: 'g2' }, games }))
    ).toEqual(['Run by someone else'])
  })

  test('a Game I am not in is named, not passed off as the shelf', () => {
    const [here] = moveDestinations({
      kind: 'pilot',
      current: { kind: 'game', gameId: 'phantom' },
      games,
    })
    expect(here?.label).toBe('Unknown game')
    expect(here?.container).toEqual({ kind: 'game', gameId: 'phantom' })
  })
})
