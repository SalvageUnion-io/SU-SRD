/**
 * `/dashboard/$pilotId` and `/mediator/$gameId` are retired: Play replaced
 * the Dashboard and the Mediator Dashboard, so each address redirects to its
 * Play screen, keeping its id (an old mech-keyed id included: `PlayGate`
 * resolves it to the pilot). Build's Game page, `/games/$gameId`, is retired
 * too: a Game's page is Play's (ADR-052 §5).
 */

import { describe, expect, test } from 'bun:test'
import { landOn } from './landOn'

describe('the retired Dashboard routes', () => {
  test('the Dashboard redirects to the pilot’s Play screen, keeping the id', async () => {
    expect(await landOn('/dashboard/p1')).toBe('/play/p1')
  })

  test('the Mediator Dashboard redirects to the Game’s Play screen, keeping the id', async () => {
    expect(await landOn('/mediator/g1')).toBe('/play/game/g1')
  })
})

describe('the retired Build Game page', () => {
  test('redirects to the Game’s page in Play, keeping the id', async () => {
    expect(await landOn('/games/g1')).toBe('/play/games/g1')
  })
})
