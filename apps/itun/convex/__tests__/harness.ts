import { convexTest } from 'convex-test'
import schema from '../schema'

/**
 * convex-test harness for Bun.
 *
 * convex-test's documented setup passes `import.meta.glob('./**\/*.*s')` so it
 * can load every Convex module. **Bun's test runner does not implement
 * `import.meta.glob`** (it is a Vite transform, and `typeof import.meta.glob`
 * is `undefined` here), so the module map is written out by hand instead.
 *
 * The consequence is that this map must be kept in step with `convex/` — a new
 * function file that is not listed here is simply invisible to the tests, which
 * fails open rather than loudly. `check-convex-parity.ts` does not cover this
 * (it compares the repo against the *deployment*), so the only thing keeping
 * the map honest is remembering. `auth.ts`, `http.ts` and `botHttp.ts` are
 * deliberately omitted: they pull in the Discord provider, the deployment's
 * auth env vars and the HTTP router, and nothing under test calls them.
 * Identity is supplied directly via `withIdentity`, which is what
 * `getAuthUserId` reads anyway.
 */
const modules = {
  // convex-test locates the modules root by finding a "_generated" path in the
  // map, so these two are required even though no test imports them directly.
  './_generated/api.js': () => import('../_generated/api'),
  './_generated/server.js': () => import('../_generated/server'),
  './account.ts': () => import('../account'),
  './botClient.ts': () => import('../botClient'),
  './crew.ts': () => import('../crew'),
  './downtime.ts': () => import('../downtime'),
  './entities.ts': () => import('../entities'),
  './games.ts': () => import('../games'),
  './maintenance.ts': () => import('../maintenance'),
  './mediator.ts': () => import('../mediator'),
  './invites.ts': () => import('../invites'),
  './ownership.ts': () => import('../ownership'),
  './proposals.ts': () => import('../proposals'),
  './templates.ts': () => import('../templates'),
  './model/bot.ts': () => import('../model/bot'),
  './model/entities.ts': () => import('../model/entities'),
  './model/permissions.ts': () => import('../model/permissions'),
}

export function testConvex() {
  return convexTest(schema, modules)
}
