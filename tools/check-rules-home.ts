#!/usr/bin/env bun
/**
 * check-rules-home — domain rules live in a rules home, never in a component
 * folder or the client app (`bun run check rules-home`).
 *
 * The app's rules once lived in four places: the reference
 * package's `lib/rules`, the app's `src/lib/rules`, `*Rules.ts` files beside the
 * components, and `convex/model`, with Convex importing client `src/` to reach
 * shared logic. Convex bundles what it imports, so a client import drags React-
 * side code into the backend, and a component folder is where nobody looks for
 * a rule. This gate fails when either comes back:
 *
 *   1. a file under `apps/web/convex/` (not `_generated/`) imports a module
 *      that resolves into the client, `apps/web/src/`. Shared logic goes to `game-domain`
 *      or `salvageunion-reference`;
 *   2. a non-test `.ts` file in a product surface's folder (under
 *      `apps/web/src/components/`, not the design system's, or in the Build
 *      and Play areas, `apps/web/src/build/` and `apps/web/src/play/`) is neither a
 *      hook (`useSeat.ts`) nor a view-model (`<name>.model.ts`). A rule goes
 *      to a rules home (the reference's `lib/rules`, `game-domain/src/rules`,
 *      the client's `src/lib/rules`); a view-model for one component stays beside
 *      it as `<name>.model.ts`, so a plain `dashboardRules.ts` or
 *      `pilotInventory.ts` has nowhere to hide in a component folder.
 *
 * No baseline: both counts are zero.
 *
 * Usage: bun tools/check-rules-home.ts
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { assertScanFloor } from 'gates/lib/scanFloor'

export const CONVEX_DIR = 'apps/web/convex'
const CLIENT_SRC = 'apps/web/src'
export const COMPONENTS_DIR = 'apps/web/src/components'
/** The areas' product surfaces: Build's folders and Play (the reference area holds pages, not product folders). */
export const AREA_DIRS = ['apps/web/src/build', 'apps/web/src/play'] as const

/** ~65% of today's counts (31 Convex files, 437 component files): a catastrophe floor. */
const CONVEX_FLOOR = 20
const COMPONENTS_FLOOR = 280

const VIEW_MODEL = /\.model\.ts$/
/** A React hook module: `useSeat.ts`. */
const HOOK = /(?:^|\/)use[A-Z][^/]*\.ts$/
const TEST_FILE = /\.(?:test|spec)\.tsx?$/

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

/**
 * The design system's own folders and barrel: their `.ts` modules are the
 * presentational helpers the primitives share (a tone's paint, a chip set),
 * not product rules, so rule 2 reads the product surfaces around them.
 */
const DESIGN_SYSTEM = new Set([
  'atoms',
  'catalog',
  'compositions',
  'containers',
  'entity',
  'markdownSection',
  'referenceEntity',
  'index.ts',
])

/** Non-test `.ts` files under a product surface's folder that are neither a hook nor a `*.model.ts`. */
export function misplacedRules(root: string): { scanned: number; problems: string[] } {
  const skip = (p: string) => p.endsWith(`${sep}node_modules`)
  const files = [
    ...walk(join(root, COMPONENTS_DIR), skip).filter(
      (f) => !DESIGN_SYSTEM.has(relative(join(root, COMPONENTS_DIR), f).split(sep)[0] ?? '')
    ),
    ...AREA_DIRS.flatMap((dir) => walk(join(root, dir), skip)),
  ]
  const problems = files
    .map((f) => relative(root, f))
    .filter((f) => f.endsWith('.ts') && !TEST_FILE.test(f) && !f.split(sep).includes('__tests__'))
    .filter((f) => !VIEW_MODEL.test(f) && !HOOK.test(f.split(sep).join('/')))
    .map(
      (f) =>
        `${f} is neither a hook (use*.ts) nor a view-model (*.model.ts): move a rule to a rules home, or rename a view-model *.model.ts`
    )
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
    `check-rules-home: ${convex.scanned} Convex files import nothing from ${CLIENT_SRC}/; ${components.scanned} component files hold only components, hooks and view-models`
  )
  return 0
}

if (import.meta.main) process.exit(main(join(import.meta.dir, '..')))
