import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'
import { getActiveContainer, setActiveContainer } from '../../stores/activeContainerStore'

/**
 * The Games pages are gone — a Game's roster and every action on it are on the
 * hub at `/`, picked in its "Showing" select. Their addresses still work,
 * through the real generated route tree:
 *
 *  - `/games` lands on the hub as it was;
 *  - `/games/$gameId` and `/mediator/$gameId` pick that Game first, so the hub
 *    shows it — the Discord bot's game links and the read-only sheet's way back
 *    to "the crew" depend on it;
 *  - the retired crew view still goes to the live sheet (`crewViewRedirect`).
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

describe('/games', () => {
  test('redirects to the hub, leaving what it shows alone', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g7' })
    expect(await landOn('/games')).toBe('/')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g7' })
  })
})

describe('/games/$gameId', () => {
  test('picks that Game, then lands on the hub', async () => {
    expect(await landOn('/games/g1')).toBe('/')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
  })

  test('the crew view beneath it still opens the live sheet', async () => {
    expect(await landOn('/games/g1/view/pilot/row-1')).toBe('/sheet/pilot/row-1')
  })
})

describe('/mediator/$gameId', () => {
  test('picks that Game, then lands on the hub, whose Mediator section is there', async () => {
    expect(await landOn('/mediator/g2')).toBe('/')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g2' })
  })
})
