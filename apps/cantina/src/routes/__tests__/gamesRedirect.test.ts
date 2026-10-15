import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'
import { getActiveContainer, setActiveContainer } from '../../stores/activeContainerStore'

/**
 * Where a container is shown, through the real generated route tree:
 *
 *  - `/` is Shelves, so it shows the shelf whatever was showing before;
 *  - `/games/$gameId` is a Game's own page, and stays put — the Discord bot's
 *    game links and the read-only sheet's way back to "the crew" land on it;
 *  - `/mediator/$gameId` is the Mediator Dashboard again, and stays
 *    put without picking the Game: it is not a container's page;
 *
 * The retired `/games`, `/join/$code` and crew-view addresses are no longer
 * routes: the Worker 301s them (`src/worker/retiredRedirects.ts`).
 *
 * `router.load()` runs every `beforeLoad` without rendering, which is all a
 * redirect needs and keeps the app shell out of this test.
 */

async function landOn(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return router.state.location.pathname
}

beforeEach(() => setActiveContainer({ kind: 'shelf' }))
afterAll(() => setActiveContainer({ kind: 'shelf' }))

describe('/', () => {
  test('is Shelves: it shows the shelf, whatever showed before', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g7' })
    expect(await landOn('/')).toBe('/')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})

describe('/games/$gameId', () => {
  test('is the Game’s own page, and shows that Game', async () => {
    expect(await landOn('/games/g1')).toBe('/games/g1')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
  })
})

describe('/mediator/$gameId', () => {
  test('is the Mediator Dashboard: it no longer redirects, and shows no container', async () => {
    expect(await landOn('/mediator/g2')).toBe('/mediator/g2')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})
