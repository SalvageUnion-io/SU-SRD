import { join } from 'node:path'
import { convexTest } from 'convex-test'
import schema from '../../convex/schema'

/**
 * convex-test harness for Bun.
 *
 * convex-test's documented setup passes `import.meta.glob('./**\/*.*s')` so it
 * can load every Convex module. Bun's test runner does not implement
 * `import.meta.glob` (it is a Vite transform), so the map is built from a
 * `Bun.Glob` scan of `convex/` instead: every module there is loadable by the
 * tests, with nothing to keep in step by hand.
 *
 * `auth.ts` and `http.ts` are left out of `testConvex()`: they pull in the
 * Discord provider and the deployment's auth env vars, and identity is supplied
 * directly via `withIdentity`, which is what `getAuthUserId` reads anyway.
 * `testConvexWithHttp()` adds them for the one test that drives sign-in through
 * the deployed HTTP routes. The other three hold no query, mutation or action:
 * `schema.ts` is passed to `convexTest` directly, `auth.config.ts` is
 * deployment config, and `botHttp.ts` exports only an `httpAction` that
 * `http.ts` routes.
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
const CONVEX_DIR = join(import.meta.dir, '../../convex')
const NOT_LOADED = new Set(['auth.ts', 'http.ts', 'schema.ts', 'auth.config.ts', 'botHttp.ts'])

// convex-test locates the modules root by finding a "_generated" path in the
// map, so the scan takes `_generated/*.js` too, though no test imports them.
const modules: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Array.from(new Bun.Glob('**/*.{ts,js}').scanSync({ cwd: CONVEX_DIR }))
    .filter((path) => !path.endsWith('.d.ts') && !NOT_LOADED.has(path))
    .map((path) => [`./${path}`, () => import(join(CONVEX_DIR, path))])
)

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
