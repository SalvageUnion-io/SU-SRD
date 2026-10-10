import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'
import { getActiveContainer, setActiveContainer } from '../../stores/activeContainerStore'

/**
 * Where a container is shown, through the real generated route tree (issue 1255):
 *
 *  - `/` is Shelves, so it shows the shelf whatever was showing before;
 *  - `/games/$gameId` is a Game's own page, and stays put — the Discord bot's
 *    game links and the read-only sheet's way back to "the crew" land on it;
 *  - `/games` and the retired `/mediator/$gameId` redirect to those;
 *  - the retired join-code page hands an old code to the invite link page;
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

describe('/', () => {
  test('is Shelves: it shows the shelf, whatever showed before', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g7' })
    expect(await landOn('/')).toBe('/')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})

describe('/games', () => {
  test('redirects to Shelves', async () => {
    expect(await landOn('/games')).toBe('/')
  })
})

describe('/games/$gameId', () => {
  test('is the Game’s own page, and shows that Game', async () => {
    expect(await landOn('/games/g1')).toBe('/games/g1')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
  })

  test('the crew view beneath it still opens the live sheet', async () => {
    expect(await landOn('/games/g1/view/pilot/row-1')).toBe('/sheet/pilot/row-1')
  })
})

describe('/mediator/$gameId', () => {
  test('lands on that Game’s own page, whose Mediator section is there', async () => {
    expect(await landOn('/mediator/g2')).toBe('/games/g2')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g2' })
  })
})

describe('/join/$code', () => {
  test('hands an old typed code to the invite link page, which joins or explains', async () => {
    expect(await landOn('/join/A1B2C3D4')).toBe('/invite/A1B2C3D4')
  })
})
