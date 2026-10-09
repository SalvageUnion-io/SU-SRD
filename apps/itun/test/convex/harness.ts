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
 * fails open rather than loudly. `auth.ts` and `http.ts` are left out of
 * `testConvex()`: they pull in the Discord provider and the deployment's auth
 * env vars, and identity is supplied directly via `withIdentity`, which is what
 * `getAuthUserId` reads anyway. `testConvexWithHttp()` adds them for the one
 * test that drives sign-in through the deployed HTTP routes.
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
  './changeLog.ts': () => import('../../convex/changeLog'),
  './claim.ts': () => import('../../convex/claim'),
  './crew.ts': () => import('../../convex/crew'),
  './downtime.ts': () => import('../../convex/downtime'),
  './entities.ts': () => import('../../convex/entities'),
  './games.ts': () => import('../../convex/games'),
  './mediator.ts': () => import('../../convex/mediator'),
  './invites.ts': () => import('../../convex/invites'),
  './maintenance.ts': () => import('../../convex/maintenance'),
  './ownership.ts': () => import('../../convex/ownership'),
  './proposals.ts': () => import('../../convex/proposals'),
  './publicSheet.ts': () => import('../../convex/publicSheet'),
  './seats.ts': () => import('../../convex/seats'),
  './shelf.ts': () => import('../../convex/shelf'),
  './templates.ts': () => import('../../convex/templates'),
  './model/bot.ts': () => import('../../convex/model/bot'),
  './model/discordInteraction.ts': () => import('../../convex/model/discordInteraction'),
  './model/entities.ts': () => import('../../convex/model/entities'),
  './model/invites.ts': () => import('../../convex/model/invites'),
  './model/permissions.ts': () => import('../../convex/model/permissions'),
  './model/referenceData.ts': () => import('../../convex/model/referenceData'),
  './model/seats.ts': () => import('../../convex/model/seats'),
}

export function testConvex() {
  return convexTest(schema, modules)
}

/**
 * `testConvex()` plus the deployed `auth.ts` and `http.ts`, so `t.fetch`
 * reaches the real router and `auth:store` resolves. For the Discord sign-in
 * test; everything else should use `testConvex()`.
 */
export function testConvexWithHttp() {
  return convexTest(schema, {
    ...modules,
    './auth.ts': () => import('../../convex/auth'),
    './http.ts': () => import('../../convex/http'),
  })
}
