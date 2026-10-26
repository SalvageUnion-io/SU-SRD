#!/usr/bin/env bun
/**
 * check-rules-home — domain rules live in a rules home, never in a component
 * folder or the client app (`bun run check rules-home`).
 *
 * A component folder is where nobody looks for a rule, so this gate fails
 * when a non-test `.ts` file in a product surface's folder (under
 * `apps/web/src/components/`, not the design system's, or in the Build and
 * Play areas, `apps/web/src/build/` and `apps/web/src/play/`) is neither a
 * hook (`useSeat.ts`) nor a view-model (`<name>.model.ts`). A rule goes to a
 * rules home (the reference's `lib/rules`, `game-domain/src/rules`, the
 * client's `src/lib/rules`); a view-model for one component stays beside it
 * as `<name>.model.ts`, so a plain `dashboardRules.ts` or `pilotInventory.ts`
 * has nowhere to hide in a component folder.
 *
 * No baseline: the count is zero.
 *
 * Usage: bun tools/check-rules-home.ts
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { assertScanFloor } from 'gates/lib/scanFloor'

export const COMPONENTS_DIR = 'apps/web/src/components'
/** The areas' product surfaces: Build's folders and Play (the reference area holds pages, not product folders). */
export const AREA_DIRS = ['apps/web/src/build', 'apps/web/src/play'] as const

/** ~65% of today's count (437 component files): a catastrophe floor. */
const COMPONENTS_FLOOR = 280

const VIEW_MODEL = /\.model\.ts$/
/** A React hook module: `useSeat.ts`. */
const HOOK = /(?:^|\/)use[A-Z][^/]*\.ts$/
const TEST_FILE = /\.(?:test|spec)\.tsx?$/

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
  if (!statSync(join(root, COMPONENTS_DIR), { throwIfNoEntry: false })?.isDirectory()) {
    error(`check-rules-home: ${COMPONENTS_DIR} not found — wrong root?`)
    return 1
  }
  const components = misplacedRules(root)
  assertScanFloor('check-rules-home (components)', components.scanned, COMPONENTS_FLOOR)
  const { problems } = components
  if (problems.length > 0) {
    error(`check-rules-home: ${problems.length} problem(s):`)
    for (const p of problems) error(`  ${p}`)
    return 1
  }
  log(
    `check-rules-home: ${components.scanned} component files hold only components, hooks and view-models`
  )
  return 0
}

if (import.meta.main) process.exit(main(join(import.meta.dir, '..')))
