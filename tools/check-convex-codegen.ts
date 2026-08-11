/**
 * Guards `apps/itun/convex/_generated/api.d.ts` against module drift.
 *
 * Why this exists: `convex/_generated/**` is COMMITTED, and every other
 * generated artifact in this repo has a drift gate — the reference package's
 * registry/schemas/API report via `check:schemas`, and `routeTree.gen.ts` in
 * CI's build-itun step. Convex's generated client had none, so it was the one
 * committed generated file that could silently go stale.
 *
 * It did. `model/entities.ts` was added in #682 while `api.d.ts` was
 * hand-edited in the same commit to DROP a different module — so the new module
 * was never registered. `model/bot.ts` and `model/permissions.ts`, structurally
 * identical helper modules, are both registered; `model/entities.ts` was not.
 * That is exactly the drift this check now fails on.
 *
 * Why not just run `convex codegen` and diff, the way check:schemas does:
 * `convex codegen` requires a `CONVEX_DEPLOYMENT` and refuses to run without
 * one ("No CONVEX_DEPLOYMENT set"). CI has no deployment credential, and fork
 * and Dependabot PRs could never have one. A gate that cannot run in CI is not
 * a gate, so this checks the property that matters and can be verified offline:
 * **the set of modules `api.d.ts` registers must equal the set of module files
 * on disk.**
 *
 * What it therefore does NOT cover: argument/return-type drift inside a module
 * that is already registered. Regenerating properly (`bunx convex dev` against
 * a real deployment) is still the source of truth; this catches the
 * add/remove/rename class, which is the one that happens by accident.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const convexDir = join(root, 'apps/itun/convex')
const apiPath = join(convexDir, '_generated/api.d.ts')

/**
 * Files Convex deliberately does not register as function modules.
 * `schema.ts` defines the data model, `auth.config.ts` is provider config, and
 * `_generated/` is the output itself.
 */
const NOT_MODULES = new Set(['schema.ts', 'auth.config.ts'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    /*
     * Convex's own rule, not a special case for `_generated`: any path segment
     * beginning with `_` is outside the function namespace entirely. That is
     * what makes `convex/__tests__/` a legal place to put tests — Convex never
     * tries to register them, so they cannot appear in `api.d.ts` and their
     * absence from it is not drift.
     *
     * Matching only `_generated` here made this check fail on the first test
     * file added under `convex/`, demanding the impossible: that codegen
     * register a module Convex refuses to see. Anyone hitting that reasonably
     * concludes tests do not belong in `convex/` and puts them nowhere.
     */
    if (entry.startsWith('_')) continue
    if (statSync(full).isDirectory()) {
      walk(full, out)
      continue
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue
    const rel = relative(convexDir, full)
    if (NOT_MODULES.has(rel)) continue
    out.push(rel.replace(/\.ts$/, ''))
  }
  return out
}

const onDisk = new Set(walk(convexDir))

const api = readFileSync(apiPath, 'utf-8')
// Every registered module appears as `import type * as X from "../<path>.js"`.
const registered = new Set(
  [...api.matchAll(/import type \* as [\w$]+ from ["']\.\.\/(.+?)\.js["']/g)]
    .map((m) => m[1])
    .filter((p): p is string => p !== undefined)
)

const missing = [...onDisk].filter((m) => !registered.has(m)).sort()
const extra = [...registered].filter((m) => !onDisk.has(m)).sort()

if (missing.length > 0 || extra.length > 0) {
  console.error('✗ Convex codegen drift — apps/itun/convex/_generated/api.d.ts is stale.')
  for (const m of missing) {
    console.error(`    convex/${m}.ts exists on disk but is NOT registered in api.d.ts`)
  }
  for (const m of extra) {
    console.error(`    api.d.ts registers convex/${m}.ts, which no longer exists`)
  }
  console.error(
    '  → regenerate with `bunx convex dev` (needs a CONVEX_DEPLOYMENT), or update\n' +
      '    api.d.ts to match the module set if you are editing it by hand.'
  )
  process.exit(1)
}

console.log(`✓ Convex codegen: api.d.ts registers all ${onDisk.size} convex modules.`)
