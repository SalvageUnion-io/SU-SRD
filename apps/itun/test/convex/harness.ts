import { convexTest } from 'convex-test'
import schema from '../../convex/schema'

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
 * This harness lives OUTSIDE `convex/` on purpose. Do not move it back.
 *
 * Convex codegen registers every file under `convex/` as a deployable module.
 * While this file sat in `convex/__tests__/`, `_generated/api.d.ts` carried
 * `"__tests__/harness": typeof __tests___harness` — so the test harness was
 * shipped to the backend as part of the deployment, and `api.d.ts` imported
 * this file while this file imports `api`, making `api`'s mapped type
 * reference itself (TS2615) and cascading every `useQuery` result in `src/`
 * to an implicit any.
 *
 * Both problems have the same cause and the same fix: a test harness is not a
 * Convex function module, so it does not belong in the directory codegen
 * scans. Moving it here removed its two lines from `_generated/api.d.ts`,
 * which is exactly what codegen emits now that the file is gone from
 * `convex/` — the generated output is a pure function of that directory's
 * contents.
 *
 * None of it was visible until `convex/` was added to `apps/itun/tsconfig.json`;
 * before that the whole backend was type-checked by nothing.
 */
const modules: Record<string, () => Promise<unknown>> = {
  // convex-test locates the modules root by finding a "_generated" path in the
  // map, so these two are required even though no test imports them directly.
  './_generated/api.js': () => import('../../convex/_generated/api'),
  './_generated/server.js': () => import('../../convex/_generated/server'),
  './account.ts': () => import('../../convex/account'),
  './botClient.ts': () => import('../../convex/botClient'),
  './crew.ts': () => import('../../convex/crew'),
  './downtime.ts': () => import('../../convex/downtime'),
  './entities.ts': () => import('../../convex/entities'),
  './games.ts': () => import('../../convex/games'),
  './mediator.ts': () => import('../../convex/mediator'),
  './invites.ts': () => import('../../convex/invites'),
  './maintenance.ts': () => import('../../convex/maintenance'),
  './ownership.ts': () => import('../../convex/ownership'),
  './proposals.ts': () => import('../../convex/proposals'),
  './templates.ts': () => import('../../convex/templates'),
  './model/bot.ts': () => import('../../convex/model/bot'),
  './model/entities.ts': () => import('../../convex/model/entities'),
  './model/permissions.ts': () => import('../../convex/model/permissions'),
}

export function testConvex() {
  return convexTest(schema, modules)
}
