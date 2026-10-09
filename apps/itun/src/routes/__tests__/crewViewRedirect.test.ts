import { describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'

/**
 * `/games/$gameId/view/$kind/$rowId` links already posted in Discord redirect
 * — through the real generated route tree — to `/sheet/$kind/$id`, carrying
 * the row id the sheet route resolves.
 */

async function landOn(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return router.state.location.pathname
}

describe('/games/$gameId/view/$kind/$entityId', () => {
  test('redirects to the live sheet', async () => {
    expect(await landOn('/games/g1/view/pilot/row-1')).toBe('/sheet/pilot/row-1')
  })

  test('for every kind a Game holds', async () => {
    expect(await landOn('/games/g1/view/mech/row-2')).toBe('/sheet/mech/row-2')
    expect(await landOn('/games/g1/view/crawler/row-3')).toBe('/sheet/crawler/row-3')
  })
})
