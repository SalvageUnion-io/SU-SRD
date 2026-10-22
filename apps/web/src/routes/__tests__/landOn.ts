import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'

/**
 * Where `path` lands through the real generated route tree: its pathname and
 * the leaf route's id. `router.load()` runs every `beforeLoad` without
 * rendering, which is all a redirect needs and keeps the app shell out of the
 * route tests. `basepath` mounts the tree as the browser sees it (`/build`,
 * ADR-048); unset, paths are the app's own.
 */
export async function land(
  path: string,
  basepath?: string
): Promise<{ pathname: string; address?: string; leaf: string | undefined }> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    ...(basepath === undefined ? {} : { basepath }),
  })
  await router.load()
  return {
    pathname: router.state.location.pathname,
    // Under `basepath`, what the address bar reads too.
    ...(basepath === undefined ? {} : { address: router.history.location.pathname }),
    leaf: router.state.matches.at(-1)?.routeId,
  }
}

/** The pathname `path` lands on (with `basepath`, the address bar's). */
export async function landOn(path: string, basepath?: string): Promise<string> {
  const landed = await land(path, basepath)
  return landed.address ?? landed.pathname
}
