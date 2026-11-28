/**
 * Retired app addresses are not routes: the Worker 301s each to where it lives
 * now (`retiredTarget`, `lib/redirects.ts`), keeping its id. Play replaced the
 * Dashboard and the Mediator Dashboard (`/dashboard/$pilotId` → the pilot's
 * Play screen, an old mech-keyed id included: `PlayGate` resolves it to the
 * pilot; `/mediator/$gameId` → the Game's Play screen), and Build's Game page,
 * `/games/$gameId`, became the Game's page in Play (ADR-052 §5). Then Play
 * moved out from under the base to `/play/…`, and the sheets and Patterns
 * took the plural grammar (ADR-062); then Play's root became the Games'
 * (`/games/…`) and each pilot's Cockpit the Play mode of its page (ADR-066). Each lands in one hop on a live route of
 * the real generated tree.
 *
 * The site's search page, `/search/`, is a page again (r5 E3): every result
 * for a query. The Worker no longer sends its address to the Reference page.
 */

import { describe, expect, test } from 'bun:test'
import { worker } from '../../worker/__tests__/worker'
import type { Env } from '../../worker/env'
import { land } from './landOn'

/** Asked of the Worker: a miss, as Static Assets hands it one. */
async function redirectOf(path: string) {
  const asked: string[] = []
  const env = {
    ASSETS: {
      fetch: async (request: Request) => {
        asked.push(new URL(request.url).pathname)
        return new Response(null, { status: 404 })
      },
    },
  } as unknown as Env
  const res = await worker.fetch(new Request(`https://salvageunion.io${path}`), env)
  return { status: res.status, location: res.headers.get('location'), asked }
}

describe('the retired app addresses', () => {
  for (const [from, to, leaf] of [
    // intheunionnow.com's, through its zone rule's `/build` + path.
    ['/build/dashboard/p1', '/build/pilots/p1/play', '/pilots/$id_/play'],
    ['/build/mediator/g1', '/games/g1/mediate', '/games/$gameId_/mediate'],
    ['/build/games/g1', '/games/g1', '/games/$gameId'],
    ['/build/games/g1/', '/games/g1', '/games/$gameId'],
    ['/build/games', '/games/', '/games/'],
    ['/build/join/AB12CD34', '/games/invite/AB12CD34', '/games/invite/$token'],
    ['/build/games/g1/view/mech/m1', '/build/mechs/m1', '/mechs/$id'],
    // Play under the base, and the sheets' and Patterns' old grammar.
    ['/build/play/', '/games/', '/games/'],
    ['/build/play', '/games/', '/games/'],
    ['/build/play/games/g1', '/games/g1', '/games/$gameId'],
    ['/build/play/game/g1', '/games/g1/mediate', '/games/$gameId_/mediate'],
    ['/build/play/p1', '/build/pilots/p1/play', '/pilots/$id_/play'],
    // Play's own root, retired for the Games and each pilot's Play (ADR-066).
    ['/play/', '/games/', '/games/'],
    ['/play', '/games/', '/games/'],
    ['/play/games/g1', '/games/g1', '/games/$gameId'],
    ['/play/games/g1/mediate', '/games/g1/mediate', '/games/$gameId_/mediate'],
    ['/play/invite/AB12CD34', '/games/invite/AB12CD34', '/games/invite/$token'],
    ['/play/pilots/p1', '/build/pilots/p1/play', '/pilots/$id_/play'],
    ['/build/invite/AB12CD34', '/games/invite/AB12CD34', '/games/invite/$token'],
    ['/build/sheet/pilot/p1', '/build/pilots/p1', '/pilots/$id'],
    ['/build/sheet/npc/n1/', '/build/npcs/n1', '/npcs/$id'],
    ['/build/mechs/patterns', '/build/patterns/', '/patterns/'],
    ['/build/mechs/patterns/', '/build/patterns/', '/patterns/'],
  ] as const) {
    test(`${from} 301s to ${to} in one hop, keeping the id and the query`, async () => {
      const { status, location, asked } = await redirectOf(`${from}?x=1`)
      expect(status).toBe(301)
      expect(location).toBe(`${to}?x=1`)
      expect(asked).toEqual([])
    })

    test(`${to} is a live route`, async () => {
      expect((await land(to, true)).leaf).toBe(leaf)
    })
  }

  test('the Games’ own addresses and a pilot’s Play are current, never retired', async () => {
    for (const path of ['/games/', '/games/g1', '/build/pilots/p1/play', '/games/invite/AB12']) {
      const { status } = await redirectOf(path)
      expect(status).not.toBe(301)
    }
  })

  test('/ is the Training Bay', async () => {
    expect(await land('/')).toEqual({ pathname: '/', leaf: '/' })
  })
})

describe('the search page', () => {
  for (const path of ['/search/?q=mule', '/search?q=mule%20pattern', '/search/']) {
    test(`${path} is the results page, not retired (r5 E3)`, async () => {
      const { status, location } = await redirectOf(path)
      expect(status).not.toBe(301)
      expect(location ?? '').not.toContain('/reference/')
    })
  }
})
