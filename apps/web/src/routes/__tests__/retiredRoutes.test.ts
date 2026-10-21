/**
 * Retired app addresses are not routes: the Worker 301s each to where it lives
 * now (`retiredTarget`, `lib/redirects.ts`), keeping its id. Play replaced the
 * Dashboard and the Mediator Dashboard (`/dashboard/$pilotId` → the pilot's
 * Play screen, an old mech-keyed id included: `PlayGate` resolves it to the
 * pilot; `/mediator/$gameId` → the Game's Play screen), and Build's Game page,
 * `/games/$gameId`, became the Game's page in Play (ADR-052 §5). Each target
 * is a live route of the real generated tree.
 *
 * The site's search page, `/search`, is retired: the bar's dropdown is the
 * search (EDL "Which form, where"). Not an app route, so the Worker answers
 * its address (`retiredSitePage`, `lib/redirects.ts`): one 301 to the home
 * page, its query kept, where the hero's search opens on it.
 */

import { describe, expect, test } from 'bun:test'
import { APP_BASE } from '../../lib/appBase'
import type { Env } from '../../worker/index'
import worker from '../../worker/index'
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
    ['/dashboard/p1', '/play/p1', '/play/$pilotId'],
    ['/mediator/g1', '/play/game/g1', '/play/game/$gameId'],
    ['/games/g1', '/play/games/g1', '/play/games/$gameId'],
    ['/games/g1/', '/play/games/g1', '/play/games/$gameId'],
  ] as const) {
    test(`${from} 301s to ${to}, keeping the id`, async () => {
      const { status, location, asked } = await redirectOf(`${APP_BASE}${from}`)
      expect(status).toBe(301)
      expect(location).toBe(`${APP_BASE}${to}`)
      expect(asked).toEqual([])
    })

    test(`${to} is a live route`, async () => {
      expect(await land(`${APP_BASE}${to}`, APP_BASE)).toEqual({
        pathname: to,
        address: `${APP_BASE}${to}`,
        leaf,
      })
    })
  }

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
