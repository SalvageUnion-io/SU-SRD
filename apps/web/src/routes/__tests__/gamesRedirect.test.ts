import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { getActiveContainer, setActiveContainer } from '../../stores/activeContainerStore'
import { landOn } from './landOn'

/**
 * Where a container is shown, through the real generated route tree:
 *
 *  - `/` is Shelves, so it shows the shelf whatever was showing before;
 *  - `/games/$gameId` is retired: it redirects to the Game's page in Play and
 *    picks no container on the way (ADR-052 §3; the redirect:
 *    `retiredRoutes.test.ts`);
 *  - `/play/games/$gameId`, the Game's page, picks none either: a unit's Game
 *    is the unit's, never the page's;
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

describe('a Game’s page', () => {
  test('the retired Build address shows no container on the way to Play', async () => {
    await landOn('/games/g1')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })

  test('the Game’s page in Play shows no container', async () => {
    expect(await landOn('/play/games/g1')).toBe('/play/games/g1')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})

describe('/mediator/$gameId', () => {
  test('shows no container on the way to Play’s Mediator screen', async () => {
    await landOn('/mediator/g2')
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})
