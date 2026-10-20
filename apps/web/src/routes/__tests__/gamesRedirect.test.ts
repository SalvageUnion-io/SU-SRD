import { describe, expect, test } from 'bun:test'
import { land, landOn } from './landOn'

/**
 * Where a Game's addresses land, through the real generated route tree. No
 * route remembers a container (ADR-052 §3): `/` is the Training Bay and a Game's page
 * is the Game its address names.
 *
 *  - `/` is the Training Bay;
 *  - `/games/$gameId` is retired: it redirects to the Game's page in Play
 *    (`retiredRoutes.test.ts` pins the redirect);
 *  - `/play/games/$gameId` is the Game's page;
 *  - `/mediator/$gameId` lands on Play's Mediator screen (its redirect:
 *    `retiredRoutes.test.ts`).
 *
 * The retired `/games`, `/join/$code` and crew-view addresses are no longer
 * routes: the Worker 301s them (`src/lib/redirects.ts`).
 */

describe('/', () => {
  test('is the Training Bay', async () => {
    expect(await land('/')).toEqual({ pathname: '/', leaf: '/' })
  })
})

describe('a Game’s page', () => {
  test('the retired Build address goes on to the Game’s page in Play', async () => {
    expect(await landOn('/games/g1')).toBe('/play/games/g1')
  })

  test('the Game’s page in Play stays put', async () => {
    expect(await landOn('/play/games/g1')).toBe('/play/games/g1')
  })
})

describe('/mediator/$gameId', () => {
  test('goes on to Play’s Mediator screen', async () => {
    expect(await landOn('/mediator/g2')).toBe('/play/game/g2')
  })
})
