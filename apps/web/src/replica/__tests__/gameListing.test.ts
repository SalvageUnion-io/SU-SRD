/**
 * A Game's listing, read from what its room's socket served (`gameListing.ts`):
 * each unit with the owner served beside its body, the links, and the primary
 * crawler the room names; nothing until the room's first snapshot.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { crawlerFixture, FIXTURE_NOW, pilotFixture } from '../../components/__tests__/fixtures'
import { readGameListing } from '../gameListing'
import { gameScope, restore, rowsOf } from '../replica'
import { foldRoomMessage } from '../roomSocket'
import { resetStores } from './resetStores'

const G1 = gameScope('g1')

const unit = (kind: 'pilot' | 'crawler', body: { id: string }, owner: string | null, seq = 1) => ({
  kind,
  appId: body.id,
  gameId: 'g1',
  owner,
  publicRead: false,
  body,
  headSeq: seq,
  fieldSeqs: {},
  updatedAt: seq,
})

const pilot = (id: string, owner: string | null, seq = 1) =>
  unit('pilot', pilotFixture({ id, gameId: 'g1' }), owner, seq)

const snapshot = (primaryCrawlerId: string | null) => ({
  type: 'snapshot',
  units: [
    pilot('p1', 'u1'),
    pilot('p2', null),
    unit('crawler', crawlerFixture({ id: 'c1', gameId: 'g1' }), null),
    unit('crawler', crawlerFixture({ id: 'c2', gameId: 'g1' }), null),
  ],
  records: { game: [{ appId: 'game', body: { primaryCrawlerId }, updatedAt: 0 }] },
  links: [
    {
      id: 'l1',
      createdAt: FIXTURE_NOW,
      type: 'pilot-to-crawler',
      from: { type: 'pilot', id: 'p1' },
      to: { type: 'crawler', id: 'c2' },
    },
  ],
})

beforeEach(resetStores)

describe('a Game’s listing', () => {
  test('is nothing until the room’s first snapshot', () => {
    expect(readGameListing('g1')).toBeUndefined()
  })

  test('lists each unit with the owner served beside it, the links and the primary crawler', () => {
    foldRoomMessage(G1, snapshot('c2'))
    const listing = readGameListing('g1')
    expect(listing?.pilots.map((p) => [p.appId, p.ownerId])).toEqual([
      ['p1', 'u1'],
      ['p2', null],
    ])
    expect(listing?.pilots[0]?.body).toMatchObject({ id: 'p1', gameId: 'g1' })
    expect(listing?.crawlers.map((c) => c._id)).toEqual(['c1', 'c2'])
    expect(listing?.softLinks.map((l) => l.id)).toEqual(['l1'])
    expect(listing?.primaryCrawlerId).toBe('c2')
    expect(listing?.mechs).toEqual([])
    expect(listing?.npcs).toEqual([])
  })

  test('follows an assignment, and keeps another room’s rows out', () => {
    foldRoomMessage(G1, snapshot(null))
    const next = snapshot(null)
    foldRoomMessage(G1, { ...next, units: [pilot('p1', 'u1'), pilot('p2', 'u2', 2)] })
    foldRoomMessage(gameScope('g2'), {
      ...snapshot(null),
      units: [{ ...pilot('p9', 'u9'), gameId: 'g2' }],
    })
    const listing = readGameListing('g1')
    expect(listing?.pilots.map((p) => [p.appId, p.ownerId])).toEqual([
      ['p1', 'u1'],
      ['p2', 'u2'],
    ])
    expect(listing?.primaryCrawlerId).toBeNull()
  })

  test('an owner kept on the device comes back with its row', () => {
    restore([
      {
        table: 'pilot',
        id: 'p1',
        row: pilotFixture({ id: 'p1', gameId: 'g1' }),
        version: 1,
        headSeq: 1,
        owner: 'u1',
        scopes: [G1],
      },
    ])
    expect(rowsOf(G1, 'pilot').map((r) => r.owner)).toEqual(['u1'])
  })
})
