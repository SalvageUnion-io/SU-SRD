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
 * fails open rather than loudly. `auth.ts` and `http.ts` are deliberately
 * omitted: they pull in the Discord provider and the deployment's auth env
 * vars, and nothing under test calls them. Identity is supplied directly via
 * `withIdentity`, which is what `getAuthUserId` reads anyway.
 */
const modules = {
  // convex-test locates the modules root by finding a "_generated" path in the
  // map, so these two are required even though no test imports them directly.
  './_generated/api.js': () => import('../_generated/api'),
  './_generated/server.js': () => import('../_generated/server'),
  './games.ts': () => import('../games'),
  './invites.ts': () => import('../invites'),
  './ownership.ts': () => import('../ownership'),
  './model/permissions.ts': () => import('../model/permissions'),
}

export function testConvex() {
  return convexTest(schema, modules)
}
