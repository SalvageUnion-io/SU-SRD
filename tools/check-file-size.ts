#!/usr/bin/env bun

/**
 * check-file-size — no source file grows past MAX_LINES (`bun run check file-size`).
 *
 * When the gate landed, 122 source files ran past 400 lines and 29 past 600:
 * `EntitySearcher.tsx` at 1,443, `convex/entities.ts` at 1,337,
 * `ReferenceEntityCard.tsx` at 1,275 (its inner card about 936 lines with about
 * 72 props). Nothing stopped one more feature landing in the largest file, so
 * the largest files kept growing, and every workstream that touched them
 * collided in them. Biome's `noExcessiveLinesPerFunction` caps a function; this
 * caps the file around it.
 *
 * The rule: a shipped or tooling `.ts`/`.tsx`/`.js`/`.mjs` file is at most
 * MAX_LINES lines. Each file already over it is held in OVER_BUDGET at its size
 * on the day the gate landed, so it can shrink but never grow. Lower an entry
 * to the new size when a split shrinks its file; delete it once the file is
 * within MAX_LINES. The gate fails an entry above its file's size, so an
 * unrecorded shrink cannot linger as slack the next change spends. Never raise
 * one and never add one: split the file instead.
 *
 * Not scanned: tests, stories, e2e specs and test harnesses (a test file grows
 * with coverage, which is the wrong thing to discourage), and generated files,
 * which nobody edits by hand.
 *
 * Usage: bun tools/check-file-size.ts
 */

import { $ } from 'bun'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertScanFloor } from 'gates/lib/scanFloor'

export const MAX_LINES = 600

/** ~65% of today's count (978 scanned files): a catastrophe floor. */
const SCAN_FLOOR = 630

/**
 * Files over MAX_LINES when the gate landed, each held at that size. Lower an
 * entry to its file's size when the file shrinks; delete it once the file is
 * within MAX_LINES.
 */
export const OVER_BUDGET: Readonly<Record<string, number>> = {
  'apps/discord-bot/src/gameCards.ts': 916,
  'apps/itun/convex/entities.ts': 852,
  'apps/itun/convex/model/entities.ts': 929,
  'apps/itun/convex/schema.ts': 777,
  'apps/itun/src/components/dashboard/Dashboard.tsx': 675,
  'apps/itun/src/components/dashboard/RollTable.tsx': 698,
  'apps/itun/src/components/npc/AnyNpcDesigner.tsx': 781,
  'apps/itun/src/components/npc/CrewBoard.tsx': 688,
  'apps/itun/src/components/shared/EntityRow.tsx': 648,
  'apps/itun/src/components/sheet/CrawlerEconomyControl.tsx': 696,
  'apps/itun/src/components/sheet/MechSheet.tsx': 671,
  'apps/itun/src/components/sheet/PilotSheet.tsx': 766,
  'apps/itun/src/components/shelves/Shelves.tsx': 676,
  'apps/itun/src/components/wizard/WizShell.tsx': 604,
  'apps/itun/src/lib/rules/creation.ts': 722,
  'apps/itun/src/stores/entityStore.ts': 715,
  'packages/component-lib/src/components/atoms/Stat.tsx': 816,
  'packages/component-lib/src/components/atoms/VitalGauge.tsx': 763,
  'packages/component-lib/src/components/referenceEntity/card/ReferenceEntityCard.tsx': 884,
  'packages/gates/lib/statFidelity.ts': 780,
  'packages/gates/rules/stylingOwnership.ts': 641,
  'packages/salvageunion-reference/lib/rules/derivedStats.ts': 660,
  'tools/check-doc-drift.ts': 1_086,
  'tools/check-rules-fidelity.ts': 1_023,
  'tools/check-workflows.ts': 812,
}

const SOURCE = /\.(tsx?|m?js)$/
/** Directories whose files are tests, test support or generated. */
const SKIPPED_DIRS = new Set([
  '__tests__',
  'e2e',
  'test',
  'generated',
  '_generated',
  'node_modules',
])
const SKIPPED_FILE = /\.(test|stories|e2e|gen)\.[^.]+$|\.d\.ts$/

/** The repo-relative paths this gate holds to a size. */
export function scannedFiles(paths: readonly string[]): string[] {
  return paths.filter((p) => {
    if (!SOURCE.test(p) || SKIPPED_FILE.test(p)) return false
    return !p.split('/').some((segment) => SKIPPED_DIRS.has(segment))
  })
}

/** Lines in `text` as `wc -l` counts them, plus a final line with no newline. */
export function lineCount(text: string): number {
  if (text === '') return 0
  const newlines = text.split('\n').length - 1
  return text.endsWith('\n') ? newlines : newlines + 1
}

/** Every problem with `sizes` (path → lines) against the budgets, one per line. */
export function sizeProblems(
  sizes: ReadonlyMap<string, number>,
  overBudget: Readonly<Record<string, number>> = OVER_BUDGET,
  max: number = MAX_LINES
): string[] {
  const problems: string[] = []
  for (const [path, lines] of sizes) {
    const budget = overBudget[path] ?? max
    if (lines > budget) {
      problems.push(
        path in overBudget
          ? `${path} is ${lines} lines, over the ${budget} it is held at. Split it; never raise its OVER_BUDGET entry.`
          : `${path} is ${lines} lines, over the ${max}-line limit. Split it into modules; never add an OVER_BUDGET entry.`
      )
    }
  }
  for (const [path, budget] of Object.entries(overBudget)) {
    const lines = sizes.get(path)
    if (lines === undefined) {
      problems.push(`OVER_BUDGET names ${path}, which is not a scanned file. Delete the entry.`)
    } else if (lines <= max) {
      problems.push(
        `${path} is ${lines} lines, within the ${max}-line limit. Delete its OVER_BUDGET entry (${budget}).`
      )
    } else if (lines < budget) {
      problems.push(
        `${path} is ${lines} lines, under the ${budget} it is held at. Lower its OVER_BUDGET entry to ${lines}.`
      )
    }
  }
  return problems
}

/** Run the gate over `paths` (repo-relative) under `root`; returns the exit code. */
export function main(
  root: string,
  paths: readonly string[],
  log = console.log,
  error = console.error,
  overBudget: Readonly<Record<string, number>> = OVER_BUDGET,
  floor: number = SCAN_FLOOR
): number {
  const files = scannedFiles(paths)
  assertScanFloor('check-file-size', files.length, floor)
  const sizes = new Map(files.map((p) => [p, lineCount(readFileSync(join(root, p), 'utf8'))]))
  const problems = sizeProblems(sizes, overBudget)
  if (problems.length > 0) {
    error(`check-file-size: ${problems.length} problem(s):`)
    for (const p of problems) error(`  ${p}`)
    return 1
  }
  log(
    `check-file-size: ${files.length} source files within ${MAX_LINES} lines; ${Object.keys(overBudget).length} held at their size`
  )
  return 0
}

if (import.meta.main) {
  const root = join(import.meta.dir, '..')
  // Tracked and untracked-but-not-ignored, so a new file fails before it is committed.
  const listed = await $`git ls-files --cached --others --exclude-standard`.cwd(root).text()
  const paths = listed.split('\n').filter((p) => p && existsSync(join(root, p)))
  process.exit(main(root, paths))
}
