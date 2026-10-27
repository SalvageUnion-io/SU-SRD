/**
 * Where each of the site Worker's routes sits (`routes.ts` answers them).
 * Astro injects one endpoint at each pattern (`astro/build/workerRoutes.ts`)
 * and picks among them as it does among pages: a fixed segment before a
 * parameter, so `miss` takes only what nothing else does. Plain paths alone,
 * so the Astro config can read it.
 */

import { APP_BASE, PLAY_ROOT } from '../lib/appBase'
import { AUTH_PREFIX } from '../lib/auth/paths'
import { HOMEBREW_PATTERNS_PATH } from '../lib/homebrew/endpoint'
import { PHOTOS_PATH, SHARED_PATH } from '../lib/sharing/paths'
import { ROOMS_PATH } from '../rooms/routes'
import { ERROR_REPORT_PATH } from './errorReports'

/** The cutover runner's door (`cutover.ts`). */
export const CUTOVER_PREFIX = '/admin/cutover/'

/** A path and everything under it, as an Astro route pattern. */
const tree = (path: string): string => `${path.replace(/\/$/, '')}/[...path]`

export const WORKER_ROUTES = [
  { name: 'errors', pattern: ERROR_REPORT_PATH },
  { name: 'auth', pattern: tree(AUTH_PREFIX) },
  { name: 'app', pattern: tree(APP_BASE) },
  { name: 'app', pattern: tree(PLAY_ROOT) },
  { name: 'cutover', pattern: tree(CUTOVER_PREFIX) },
  { name: 'rooms', pattern: tree(ROOMS_PATH) },
  { name: 'shared', pattern: tree(SHARED_PATH) },
  { name: 'photos', pattern: tree(PHOTOS_PATH) },
  { name: 'homebrew', pattern: HOMEBREW_PATTERNS_PATH },
  { name: 'miss', pattern: '/[...path]' },
] as const

export type WorkerRouteName = (typeof WORKER_ROUTES)[number]['name']

/** The route Astro injected at `pattern`. */
export function workerRouteAt(pattern: string): WorkerRouteName {
  const route = WORKER_ROUTES.find((each) => each.pattern === pattern)
  if (route === undefined) throw new Error(`no Worker route at ${pattern}`)
  return route.name
}
