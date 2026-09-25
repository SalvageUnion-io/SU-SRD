/**
 * Guards `apps/itun/convex/_generated/api.d.ts` against module drift.
 *
 * Why this exists: `convex/_generated/**` is COMMITTED, and every other
 * generated artifact in this repo has a drift gate — the reference package's
 * registry/schemas/API report and `routeTree.gen.ts`, via
 * `tools/check-generated.ts`. Convex's generated client had none, so it was
 * the one committed generated file that could silently go stale.
 *
 * It did. `model/entities.ts` was added in #682 while `api.d.ts` was
 * hand-edited in the same commit to DROP a different module — so the new module
 * was never registered. `model/bot.ts` and `model/permissions.ts`, structurally
 * identical helper modules, are both registered; `model/entities.ts` was not.
 * That is exactly the drift this check now fails on.
 *
 * Why not just run `convex codegen` and diff, the way check-generated does:
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

/** Every Convex function module under `convexDir`, as `path/without/ext`. */
export function modulesOnDisk(convexDir: string): Set<string> {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (entry === '_generated') continue
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue
      const rel = relative(convexDir, full)
      if (NOT_MODULES.has(rel)) continue
      out.push(rel.replace(/\.ts$/, ''))
    }
  }
  walk(convexDir)
  return new Set(out)
}

/** Every module `api.d.ts` registers — each is `import type * as X from "../<path>.js"`. */
export function registeredModules(api: string): Set<string> {
  return new Set(
    [...api.matchAll(/import type \* as [\w$]+ from ["']\.\.\/(.+?)\.js["']/g)]
      .map((m) => m[1])
      .filter((p): p is string => p !== undefined)
  )
}

export function codegenDrift(
  onDisk: ReadonlySet<string>,
  registered: ReadonlySet<string>
): { missing: string[]; extra: string[] } {
  return {
    missing: [...onDisk].filter((m) => !registered.has(m)).sort(),
    extra: [...registered].filter((m) => !onDisk.has(m)).sort(),
  }
}

function main(): void {
  const onDisk = modulesOnDisk(convexDir)
  const { missing, extra } = codegenDrift(onDisk, registeredModules(readFileSync(apiPath, 'utf-8')))

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
}

if (import.meta.main) main()
