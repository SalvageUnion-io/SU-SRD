/**
 * Every route of the site Worker (`astro/build/workerRoutes.ts`): the route
 * Astro matched, by its pattern, answers with the Worker's bindings.
 */

import { env } from 'cloudflare:workers'
import type { APIRoute } from 'astro'
import type { Env } from '../../src/worker/env'
import { SERVE } from '../../src/worker/routes'
import { workerRouteAt } from '../../src/worker/routeTable'

export const ALL: APIRoute = ({ request, routePattern }) =>
  SERVE[workerRouteAt(routePattern)](request, env as unknown as Env)
