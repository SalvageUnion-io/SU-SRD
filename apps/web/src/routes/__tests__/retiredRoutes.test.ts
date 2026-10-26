/**
 * Retired app addresses are not routes: the Worker 301s each to where it lives
 * now (`retiredTarget`, `lib/redirects.ts`), keeping its id. Play replaced the
 * Dashboard and the Mediator Dashboard (`/dashboard/$pilotId` → the pilot's
 * Play screen, an old mech-keyed id included: `PlayGate` resolves it to the
 * pilot; `/mediator/$gameId` → the Game's Play screen), and Build's Game page,
 * `/games/$gameId`, became the Game's page in Play (ADR-052 §5). Then Play
 * moved out from under the base to `/play/…`, and the sheets and Patterns
 * took the plural grammar (ADR-062). Each lands in one hop on a live route of
 * the real generated tree.
 *
 * The site's search page, `/search`, is retired: the bar's dropdown is the
 * search (EDL "Which form, where"). Not an app route, so the Worker answers
 * its address (`retiredSitePage`, `lib/redirects.ts`): one 301 to the home
 * page, its query kept, where the hero's search opens on it.
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
    ['/build/dashboard/p1', '/play/pilots/p1', '/play/pilots/$pilotId'],
    ['/build/mediator/g1', '/play/games/g1/mediate', '/play/games/$gameId_/mediate'],
    ['/build/games/g1', '/play/games/g1', '/play/games/$gameId'],
    ['/build/games/g1/', '/play/games/g1', '/play/games/$gameId'],
    ['/build/games', '/play/', '/play/'],
    ['/build/join/AB12CD34', '/play/invite/AB12CD34', '/play/invite/$token'],
    ['/build/games/g1/view/mech/m1', '/build/mechs/m1', '/mechs/$id'],
    // Play under the base, and the sheets' and Patterns' old grammar.
    ['/build/play/', '/play/', '/play/'],
    ['/build/play', '/play/', '/play/'],
    ['/build/play/games/g1', '/play/games/g1', '/play/games/$gameId'],
    ['/build/play/game/g1', '/play/games/g1/mediate', '/play/games/$gameId_/mediate'],
    ['/build/play/p1', '/play/pilots/p1', '/play/pilots/$pilotId'],
    ['/build/invite/AB12CD34', '/play/invite/AB12CD34', '/play/invite/$token'],
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

  test("Play's own addresses are current, never retired", async () => {
    for (const path of ['/play/', '/play/games/g1', '/play/pilots/p1', '/play/invite/AB12']) {
      const { status } = await redirectOf(path)
      expect(status).not.toBe(301)
    }
  })

  test('/ is the Training Bay', async () => {
    expect(await land('/')).toEqual({ pathname: '/', leaf: '/' })
  })
})

describe('the retired search page', () => {
  for (const [from, to] of [
    ['/search/?q=mule', '/?q=mule'],
    ['/search?q=mule%20pattern', '/?q=mule%20pattern'],
    ['/search/', '/'],
    ['/search', '/'],
  ] as const) {
    test(`${from} lands on the home page's search: ${to}`, async () => {
      const { status, location, asked } = await redirectOf(from)
      expect(status).toBe(301)
      expect(location).toBe(to)
      // Decided without the asset binding: the page is gone, not missing.
      expect(asked).toEqual([])
    })
  }
})
