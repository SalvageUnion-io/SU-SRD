/**
 * The site Worker's routes as Astro endpoints: `astro/worker/route.ts`,
 * injected on demand at each pattern of `WORKER_ROUTES`
 * (`src/worker/routeTable.ts`). Their names start with `__` or sit beside
 * pages, so they are injected rather than files under `pages/`, which skips a
 * name that starts with `_`.
 */

import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { WORKER_ROUTES } from '../../src/worker/routeTable'

const ENDPOINT = fileURLToPath(new URL('../worker/route.ts', import.meta.url))

export function workerRoutes(): AstroIntegration {
  return {
    name: 'su:worker-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const { pattern } of WORKER_ROUTES) {
          injectRoute({ pattern, entrypoint: ENDPOINT, prerender: false })
        }
      },
    },
  }
}
