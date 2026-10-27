/**
 * The site Worker as a test reaches it. Its entry (`../index.ts`) hands
 * `fetch` to the Cloudflare adapter, which exists only in Astro's build, so
 * this routes a request the way Astro does among `WORKER_ROUTES`: each
 * pattern a path or a tree (`[...path]`), the catch-all last.
 */

import { runCron } from '../crons'
import type { Env } from '../env'
import { SERVE } from '../routes'
import type { WorkerRouteName } from '../routeTable'
import { WORKER_ROUTES } from '../routeTable'

const TREE = '/[...path]'

/** The route Astro picks for `pathname`. */
export function routeFor(pathname: string): WorkerRouteName {
  const path = pathname.replace(/\/$/, '') || '/'
  for (const { name, pattern } of WORKER_ROUTES) {
    if (!pattern.endsWith(TREE)) {
      if (path === pattern) return name
      continue
    }
    const root = pattern.slice(0, -TREE.length)
    if (root === '' || path === root || path.startsWith(`${root}/`)) return name
  }
  throw new Error(`no Worker route for ${pathname}`)
}

export const worker = {
  scheduled: (controller: { cron: string; scheduledTime: number }, env: Env) =>
    runCron(controller.cron, env, controller.scheduledTime),
  fetch: (request: Request, env: Env) =>
    SERVE[routeFor(new URL(request.url).pathname)](request, env),
}
