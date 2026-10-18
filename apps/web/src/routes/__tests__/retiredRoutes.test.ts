/**
 * `/dashboard/$pilotId` and `/mediator/$gameId` are retired: Play replaced
 * the Dashboard and the Mediator Dashboard, so each address redirects to its
 * Play screen, keeping its id (an old mech-keyed id included: `PlayGate`
 * resolves it to the pilot).
 *
 * `router.load()` runs every `beforeLoad` without rendering, which is all a
 * redirect needs and keeps the app shell out of this test.
 */

import { describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'

async function landOn(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return router.state.location.pathname
}

describe('the retired Dashboard routes', () => {
  test('the Dashboard redirects to the pilot’s Play screen, keeping the id', async () => {
    expect(await landOn('/dashboard/p1')).toBe('/play/p1')
  })

  test('the Mediator Dashboard redirects to the Game’s Play screen, keeping the id', async () => {
    expect(await landOn('/mediator/g1')).toBe('/play/game/g1')
  })
})
