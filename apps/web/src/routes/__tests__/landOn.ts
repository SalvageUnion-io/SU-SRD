import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'

/**
 * Where `path` lands through the real generated route tree: its pathname and
 * the leaf route's id. `router.load()` runs every `beforeLoad` without
 * rendering, which is all a redirect needs and keeps the app shell out of the
 * route tests.
 */
export async function land(path: string): Promise<{ pathname: string; leaf: string | undefined }> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return {
    pathname: router.state.location.pathname,
    leaf: router.state.matches.at(-1)?.routeId,
  }
}

/** The pathname `path` lands on. */
export async function landOn(path: string): Promise<string> {
  return (await land(path)).pathname
}
