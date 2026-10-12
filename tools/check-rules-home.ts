#!/usr/bin/env bun
/**
 * check-rules-home — domain rules live in a rules home, never in a component
 * folder or the client app (`bun run check rules-home`).
 *
 * ITUN's rules once lived in four places: the reference
 * package's `lib/rules`, ITUN's `src/lib/rules`, `*Rules.ts` files beside the
 * components, and `convex/model`, with Convex importing client `src/` to reach
 * shared logic. Convex bundles what it imports, so a client import drags React-
 * side code into the backend, and a component folder is where nobody looks for
 * a rule. This gate fails when either comes back:
 *
 *   1. a file under `apps/itun/convex/` (not `_generated/`) imports a module
 *      that resolves into `apps/itun/src/`. Shared logic goes to `itun-domain`
 *      or `salvageunion-reference`;
 *   2. a non-test `.ts` file under `apps/itun/src/components/` is named like a
 *      rules or model module (`dashboardRules.ts`, `slotModels.ts`) without the
 *      view-model suffix `.model.ts`. A rule goes to a rules home (the
 *      reference's `lib/rules`, `itun-domain/src/rules`, ITUN's
 *      `src/lib/rules`); a view-model for one component stays beside it as
 *      `<name>.model.ts`.
 *
 * No baseline: both counts were zero when the gate landed.
 *
 * Usage: bun tools/check-rules-home.ts
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { assertScanFloor } from 'gates/lib/scanFloor'

export const CONVEX_DIR = 'apps/itun/convex'
export const CLIENT_SRC = 'apps/itun/src'
export const COMPONENTS_DIR = 'apps/itun/src/components'

/** ~65% of today's counts (31 Convex files, 437 component files): a catastrophe floor. */
const CONVEX_FLOOR = 20
const COMPONENTS_FLOOR = 280

/** A rules- or model-named module: `fooRules.ts`, `foo.rules.ts`, `fooModel.ts`, `fooModels.ts`. */
const RULES_NAME = /(?:rules|models?)\.ts$/i
const VIEW_MODEL = /\.model\.ts$/
const TEST_FILE = /\.(?:test|spec|stories)\.tsx?$/

/** Every specifier in `import … from`, `export … from`, `import(…)` and bare `import '…'`. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g

function walk(dir: string, skip: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (skip(path)) continue
    if (entry.isDirectory()) out.push(...walk(path, skip))
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

/** Relative specifiers in `source`; package specifiers are another workspace and fine. */
export function relativeSpecifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].flatMap((m) => (m[2]?.startsWith('.') ? [m[2]] : []))
}

/** Convex files whose relative imports land in the client's `src/`, as `file → specifier`. */
export function convexClientImports(root: string): { scanned: number; problems: string[] } {
  const clientSrc = resolve(root, CLIENT_SRC) + sep
  const files = walk(
    join(root, CONVEX_DIR),
    (p) => p.endsWith(`${sep}_generated`) || p.endsWith(`${sep}node_modules`)
  )
  const problems: string[] = []
  for (const file of files) {
    for (const spec of relativeSpecifiers(readFileSync(file, 'utf8'))) {
      const target = resolve(dirname(file), spec)
      if (`${target}${sep}`.startsWith(clientSrc)) {
        problems.push(`${relative(root, file)} imports '${spec}' (client src/)`)
      }
    }
  }
  return { scanned: files.length, problems }
}

/** Rules- or model-named logic files under `components/` that are not `*.model.ts`. */
export function misplacedRules(root: string): { scanned: number; problems: string[] } {
  const files = walk(join(root, COMPONENTS_DIR), (p) => p.endsWith(`${sep}node_modules`))
  const problems = files
    .map((f) => relative(root, f))
    .filter((f) => f.endsWith('.ts') && !TEST_FILE.test(f) && !f.split(sep).includes('__tests__'))
    .filter((f) => RULES_NAME.test(f) && !VIEW_MODEL.test(f))
    .map((f) => `${f} is rules-named inside components/`)
  return { scanned: files.length, problems }
}

/** Run the gate against `root`; returns the exit code. */
export function main(root: string, log = console.log, error = console.error): number {
  if (!statSync(join(root, CONVEX_DIR), { throwIfNoEntry: false })?.isDirectory()) {
    error(`check-rules-home: ${CONVEX_DIR} not found — wrong root?`)
    return 1
  }
  const convex = convexClientImports(root)
  const components = misplacedRules(root)
  assertScanFloor('check-rules-home (convex)', convex.scanned, CONVEX_FLOOR)
  assertScanFloor('check-rules-home (components)', components.scanned, COMPONENTS_FLOOR)
  const problems = [...convex.problems, ...components.problems]
  if (problems.length > 0) {
    error(`check-rules-home: ${problems.length} problem(s):`)
    for (const p of problems) error(`  ${p}`)
    return 1
  }
  log(
    `check-rules-home: ${convex.scanned} Convex files import nothing from ${CLIENT_SRC}/; ${components.scanned} component files hold no rules-named module`
  )
  return 0
}

if (import.meta.main) process.exit(main(join(import.meta.dir, '..')))
