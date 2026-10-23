import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { APP_REWRITE } from '../../lib/appBase'
import { routeTree } from '../../routeTree.gen'

/**
 * Where `path` lands through the real generated route tree: its pathname and
 * the leaf route's id. `router.load()` runs every `beforeLoad` without
 * rendering, which is all a redirect needs and keeps the app shell out of the
 * route tests. `onSite` mounts the tree as the browser sees it, through the
 * app's rewrite (`/build/…` and `/play/…`, `APP_REWRITE`); unset, paths are the
 * app's own.
 */
export async function land(
  path: string,
  onSite = false
): Promise<{ pathname: string; address?: string; leaf: string | undefined }> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    ...(onSite ? { rewrite: APP_REWRITE } : {}),
  })
  await router.load()
  return {
    pathname: router.state.location.pathname,
    // On the site, what the address bar reads too.
    ...(onSite ? { address: router.history.location.pathname } : {}),
    leaf: router.state.matches.at(-1)?.routeId,
  }
}

/** The pathname `path` lands on (`onSite`, the address bar's). */
export async function landOn(path: string, onSite = false): Promise<string> {
  const landed = await land(path, onSite)
  return landed.address ?? landed.pathname
}
