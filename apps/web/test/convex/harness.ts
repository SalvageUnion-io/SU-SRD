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
 * `http.ts` is left out of `testConvex()`: identity is supplied directly via
 * `withIdentity`, which is what `getAuthUserId` reads anyway.
 * `testConvexWithHttp()` adds it for the tests that drive the deployed HTTP
 * routes. The other three hold no query, mutation or action:
 * `schema.ts` is passed to `convexTest` directly, `auth.config.ts` is
 * deployment config, and `botHttp.ts` exports only an `httpAction` that
 * `http.ts` routes.
 */
/**
 * Lives OUTSIDE `convex/` on purpose; do not move it back. Codegen registers every file
 * there as a deployable module, so a harness inside it ships to the backend, and because it
 * imports `api`, `api`'s type references itself (TS2615) and every `useQuery` result in
 * `src/` degrades to an implicit any.
 */
const CONVEX_DIR = join(import.meta.dir, '../../convex')
const NOT_LOADED = new Set(['http.ts', 'schema.ts', 'auth.config.ts', 'botHttp.ts'])

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
 * `testConvex()` plus the deployed `http.ts`, so `t.fetch` reaches the real
 * router; everything that does not need it should use `testConvex()`.
 */
export function testConvexWithHttp() {
  return convexTest(schema, { ...modules, './http.ts': () => import('../../convex/http') })
}
