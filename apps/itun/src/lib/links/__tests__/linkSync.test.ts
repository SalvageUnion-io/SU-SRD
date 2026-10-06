/**
 * `WiringSync`'s reconcile plans (ADR-037): links and Game crawlers down from
 * `entities.listWiring`, server wins, pruning only where the server spoke.
 */

import { describe, expect, test } from 'bun:test'
import type { Container } from '../../container'
import { SHELF } from '../../container'
import type { SoftLink } from '../../schemas/softLink'
import type { ServedCrawler, ServedLink } from '../linkSync'
import { planCrawlerSync, planLinkSync, softLinkFromServer } from '../linkSync'

const T0 = Date.parse('2026-01-01T00:00:00.000Z')

function served(id: string, from: string, to: string, gameId: string | null = 'g1'): ServedLink {
  return {
    _id: id,
    _creationTime: T0,
    gameId,
    from: { type: 'pilot', id: from },
    to: { type: 'crawler', id: to },
    type: 'pilot-to-crawler',
  }
}

function local(id: string, from: string, to: string): SoftLink {
  return {
    id,
    from: { type: 'pilot', id: from },
    to: { type: 'crawler', id: to },
    type: 'pilot-to-crawler',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const game = (gameId: string): Container => ({ kind: 'game', gameId })

describe('planLinkSync', () => {
  const where: Record<string, Container> = {
    p1: game('g1'),
    p2: game('g1'),
    ps: SHELF,
    px: game('gx'),
  }
  const containerOfEnd = (ref: { id: string }) => where[ref.id] ?? null
  const gameIds = new Set(['g1'])

  test('adopts a served link this browser lacks, under the server row id', () => {
    const plan = planLinkSync({
      local: [],
      served: [served('srv-1', 'p1', 'c1')],
      gameIds,
      containerOfEnd,
      mayPrune: true,
    })
    expect(plan.adopt).toEqual([softLinkFromServer(served('srv-1', 'p1', 'c1'))])
    expect(plan.adopt[0]?.id).toBe('srv-1')
    expect(plan.prune).toEqual([])
  })

  test('a link already held under a local id is matched by endpoints, not adopted twice', () => {
    const plan = planLinkSync({
      local: [local('mine', 'p1', 'c1')],
      served: [served('srv-1', 'p1', 'c1')],
      gameIds,
      containerOfEnd,
      mayPrune: true,
    })
    expect(plan).toEqual({ adopt: [], prune: [] })
  })

  test('prunes a covered link the server no longer has — reassigned elsewhere', () => {
    const plan = planLinkSync({
      local: [local('old', 'p1', 'c1')],
      served: [served('srv-2', 'p1', 'c2')],
      gameIds,
      containerOfEnd,
      mayPrune: true,
    })
    expect(plan.adopt.map((l) => l.to.id)).toEqual(['c2'])
    expect(plan.prune).toEqual(['old'])
  })

  test('a shelf link is covered: every one is drawn from an entity the caller owns', () => {
    const plan = planLinkSync({
      local: [local('old', 'ps', 'cs')],
      served: [],
      gameIds,
      containerOfEnd,
      mayPrune: true,
    })
    expect(plan.prune).toEqual(['old'])
  })

  test("never prunes a link in a Game the answer did not cover, or whose ends aren't cached", () => {
    const plan = planLinkSync({
      local: [local('other-game', 'px', 'cx'), local('unknown', 'nobody', 'nothing')],
      served: [],
      gameIds,
      containerOfEnd,
      mayPrune: true,
    })
    expect(plan.prune).toEqual([])
  })

  test('drops a second local copy of a link the server holds once', () => {
    const plan = planLinkSync({
      local: [local('a', 'p1', 'c1'), local('b', 'p1', 'c1')],
      served: [served('srv-1', 'p1', 'c1')],
      gameIds,
      containerOfEnd,
      mayPrune: true,
    })
    expect(plan.prune).toEqual(['b'])
  })

  test('prunes nothing while absence cannot be trusted', () => {
    const plan = planLinkSync({
      local: [local('old', 'p1', 'c1')],
      served: [],
      gameIds,
      containerOfEnd,
      mayPrune: false,
    })
    expect(plan.prune).toEqual([])
  })
})

describe('planCrawlerSync', () => {
  function row(id: string, gameId: string, updatedAt = 1, extra: object = {}): ServedCrawler {
    return {
      appId: id,
      gameId,
      updatedAt,
      body: { id, name: `Crawler ${id}`, gameId: null, ...extra },
    }
  }
  const gameIds = new Set(['g1'])

  test('adopts a Game crawler, filed under the ROW container even when the body says shelf', () => {
    const plan = planCrawlerSync({
      local: [],
      served: [row('c1', 'g1')],
      gameIds,
      adoptedAt: new Map(),
      mayPrune: true,
    })
    expect(plan.adopt).toHaveLength(1)
    expect(plan.adopt[0]?.body.gameId).toBe('g1')
  })

  test("re-adopts when the row moved on — a crewmate's edit reaches this cache", () => {
    const local = [{ id: 'c1', gameId: 'g1' }]
    const unchanged = planCrawlerSync({
      local,
      served: [row('c1', 'g1', 5)],
      gameIds,
      adoptedAt: new Map([['c1', 5]]),
      mayPrune: true,
    })
    expect(unchanged.adopt).toEqual([])

    const edited = planCrawlerSync({
      local,
      served: [row('c1', 'g1', 6)],
      gameIds,
      adoptedAt: new Map([['c1', 5]]),
      mayPrune: true,
    })
    expect(edited.adopt.map((c) => c.id)).toEqual(['c1'])
  })

  test('forgets a cached crawler a covered Game no longer has — scrapped or moved out', () => {
    const plan = planCrawlerSync({
      local: [
        { id: 'gone', gameId: 'g1' },
        { id: 'elsewhere', gameId: 'g2' },
        { id: 'mine', gameId: null },
      ],
      served: [],
      gameIds,
      adoptedAt: new Map(),
      mayPrune: true,
    })
    expect(plan.prune).toEqual(['gone'])
  })

  test('forgets nothing while absence cannot be trusted', () => {
    const plan = planCrawlerSync({
      local: [{ id: 'gone', gameId: 'g1' }],
      served: [],
      gameIds,
      adoptedAt: new Map(),
      mayPrune: false,
    })
    expect(plan.prune).toEqual([])
  })
})
