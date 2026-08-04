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
/**
 * `load` takes a NON-LITERAL specifier on purpose. Do not inline these back to
 * `() => import('../_generated/api')`.
 *
 * Convex codegen scans every file under `convex/`, so it registered THIS file
 * as a deployable module — `_generated/api.d.ts` carries
 * `"__tests__/harness": typeof __tests___harness`. So `api.d.ts` imports this
 * file, and this file imports `api`. With a literal specifier TypeScript must
 * resolve that module's type to check the import, and `api`'s mapped type then
 * references itself: TS2615, which cascades every `useQuery` result in `src/`
 * to an implicit any. Routing the two `_generated` entries through a `string`
 * parameter means TS cannot resolve them statically, which cuts the cycle
 * without touching a generated file. The other entries are safe as literals —
 * none of those modules imports `api` back.
 *
 * It stayed invisible for as long as it did because `convex/` was in no
 * tsconfig at all; adding it to `apps/itun/tsconfig.json` is what surfaced this.
 *
 * The deeper issue is that a test harness is a deployable Convex module at all.
 * Fixing that means moving this file out of `convex/` so codegen stops claiming
 * it, which requires re-running `convex codegen` against a deployment to
 * regenerate the committed `_generated/api.d.ts` — so it is deliberately not
 * done here. Test code currently ships to the backend.
 */
const load = (specifier: string): Promise<unknown> => import(specifier)

const modules: Record<string, () => Promise<unknown>> = {
  // convex-test locates the modules root by finding a "_generated" path in the
  // map, so these two are required even though no test imports them directly.
  './_generated/api.js': () => load('../_generated/api'),
  './_generated/server.js': () => load('../_generated/server'),
  './account.ts': () => import('../account'),
  './bot.ts': () => import('../bot'),
  './botClient.ts': () => import('../botClient'),
  './crew.ts': () => import('../crew'),
  './downtime.ts': () => import('../downtime'),
  './entities.ts': () => import('../entities'),
  './games.ts': () => import('../games'),
  './mediator.ts': () => import('../mediator'),
  './invites.ts': () => import('../invites'),
  './ownership.ts': () => import('../ownership'),
  './proposals.ts': () => import('../proposals'),
  './templates.ts': () => import('../templates'),
  './model/bot.ts': () => import('../model/bot'),
  './model/permissions.ts': () => import('../model/permissions'),
}

export function testConvex() {
  return convexTest(schema, modules)
}
