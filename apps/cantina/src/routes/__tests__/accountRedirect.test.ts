import { describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'

/**
 * `/account` became `/settings`. The old address must keep working — it is in
 * bookmarks, in old links, and in the Discord bot's replies — so it redirects,
 * through the real generated route tree rather than a hand-built copy of it.
 *
 * `router.load()` resolves matches and runs every `beforeLoad` without
 * rendering, which is all a redirect needs and keeps the app shell (Convex,
 * the reference-data gate) out of this test.
 */

async function landOn(path: string): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return router.state.location.pathname
}

describe('/account', () => {
  test('redirects to /settings', async () => {
    expect(await landOn('/account')).toBe('/settings')
  })

  test('/settings itself stays put', async () => {
    expect(await landOn('/settings')).toBe('/settings')
  })
})
