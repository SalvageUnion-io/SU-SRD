import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { getActiveContainer, setActiveContainer } from '../../stores/activeContainerStore'
import { landOn } from './landOn'

/**
 * Where a container is shown, through the real generated route tree:
 *
 *  - `/` is Shelves, so it shows the shelf whatever was showing before;
 *  - `/games/$gameId` is a Game's own page, and stays put — the Discord bot's
 *    game links and the read-only sheet's way back to "the crew" land on it;
 *  - `/mediator/$gameId` lands on Play's Mediator screen without picking the
 *    Game: it is not a container's page (its redirect: `retiredRoutes.test.ts`);
 *
 * The retired `/games`, `/join/$code` and crew-view addresses are no longer
 * routes: the Worker 301s them (`src/lib/redirects.ts`).
 */

beforeEach(() => setActiveContainer({ kind: 'shelf' }))
afterAll(() => setActiveContainer({ kind: 'shelf' }))

describe('/', () => {
  test('is Hangar: it shows the shelf, whatever showed before', async () => {
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
  test('shows no container on the way to Play’s Mediator screen', async () => {
    await landOn('/mediator/g2')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})
