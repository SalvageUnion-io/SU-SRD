#!/usr/bin/env bun

/**
 * check-test-layout — one test layout, and a root preload that matches the
 * workspaces' (`bun run check test-layout`).
 *
 * The refit ledger (T5) found two layouts: ITUN kept ~233 tests in
 * `__tests__/` and ~41 beside its Convex harness, the reference package kept
 * all ~56 beside their subjects. It also found the root `bunfig.toml` preload,
 * a hand-kept union of the workspace preloads, missing ITUN's
 * `test/convexClientStub.ts`. This gate fails when either comes back:
 *
 *   1. a `*.test.ts(x)` with no `__tests__` directory in its path. Tests live
 *      in a `__tests__/` beside their subject;
 *   2. the root `[test] preload` is not exactly the union of every workspace
 *      bunfig's, or reorders one workspace's list (ITUN's `test/env.ts` must
 *      precede happy-dom). A root-level `bun test` uses the root bunfig alone.
 *
 * A check rather than a generator: the root bunfig also carries the `[install]`
 * settings and their comments, which a rewrite would have to round-trip, and a
 * new preload is rare enough that a printed fix is cheaper than a writer.
 *
 * No baseline: both counts were zero when the gate landed.
 *
 * Usage: bun tools/check-test-layout.ts
 */

import { $ } from 'bun'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { assertScanFloor } from './lib/scanFloor'

/** ~65% of today's count (544 test files): a catastrophe floor. */
const TEST_FLOOR = 350

const TEST_FILE = /\.test\.tsx?$/

/** Test files whose path has no `__tests__` directory. */
export function siblingTests(paths: readonly string[]): string[] {
  return paths.filter((p) => TEST_FILE.test(p) && !p.split('/').includes('__tests__'))
}

export type Preloads = { dir: string; preload: readonly string[] }

/** `[test] preload` from a bunfig's text; `[]` when it sets none. */
export function readPreload(toml: string): string[] {
  const test = (Bun.TOML.parse(toml) as { test?: { preload?: string | string[] } }).test
  const preload = test?.preload ?? []
  return typeof preload === 'string' ? [preload] : preload
}

/** A preload entry as a repo-relative path, from the bunfig directory it is written in. */
function normalize(root: string, dir: string, entry: string): string {
  return relative(root, resolve(root, dir, entry))
}

/** How the root preload differs from the workspaces' union, one problem per line. */
export function preloadDrift(
  root: string,
  rootPreload: readonly string[],
  workspaces: readonly Preloads[]
): string[] {
  const rootList = rootPreload.map((p) => normalize(root, '.', p))
  const problems: string[] = []
  const wanted = new Set<string>()
  for (const { dir, preload } of workspaces) {
    const list = preload.map((p) => normalize(root, dir, p))
    for (const p of list) wanted.add(p)
    const missing = list.filter((p) => !rootList.includes(p))
    for (const p of missing)
      problems.push(`root preload is missing ./${p} (from ${dir}/bunfig.toml)`)
    const present = list.filter((p) => rootList.includes(p))
    const positions = present.map((p) => rootList.indexOf(p))
    if (positions.some((at, i) => i > 0 && at < (positions[i - 1] ?? 0))) {
      problems.push(`root preload reorders ${dir}/bunfig.toml's: ${present.join(', ')}`)
    }
  }
  for (const p of rootList) {
    if (!wanted.has(p)) problems.push(`root preload lists ./${p}, which no workspace preloads`)
  }
  return problems
}

/** Every workspace bunfig: `apps/*`, `packages/*` and `tools`. */
export function workspacePreloads(root: string): Preloads[] {
  const dirs = ['apps', 'packages'].flatMap((base) =>
    existsSync(join(root, base))
      ? readdirSync(join(root, base), { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => `${base}/${e.name}`)
      : []
  )
  return [...dirs.sort(), 'tools']
    .filter((dir) => existsSync(join(root, dir, 'bunfig.toml')))
    .map((dir) => ({
      dir,
      preload: readPreload(readFileSync(join(root, dir, 'bunfig.toml'), 'utf8')),
    }))
}

/** Run the gate over `paths` (repo-relative) under `root`; returns the exit code. */
export function main(
  root: string,
  paths: readonly string[],
  log = console.log,
  error = console.error
): number {
  const tests = paths.filter((p) => TEST_FILE.test(p))
  assertScanFloor('check-test-layout', tests.length, TEST_FLOOR)
  const rootPreload = readPreload(readFileSync(join(root, 'bunfig.toml'), 'utf8'))
  const workspaces = workspacePreloads(root)
  const problems = [
    ...siblingTests(tests).map((p) => `${p} is outside a __tests__/ directory`),
    ...preloadDrift(root, rootPreload, workspaces),
  ]
  if (problems.length > 0) {
    error(`check-test-layout: ${problems.length} problem(s):`)
    for (const p of problems) error(`  ${p}`)
    return 1
  }
  log(
    `check-test-layout: ${tests.length} test files sit in __tests__/; the root preload is the union of ${workspaces.length} workspace bunfigs`
  )
  return 0
}

if (import.meta.main) {
  const root = join(import.meta.dir, '..')
  // Tracked and untracked-but-not-ignored, so a new test fails before it is committed.
  const listed = await $`git ls-files --cached --others --exclude-standard`.cwd(root).text()
  const paths = listed.split('\n').filter((p) => p && existsSync(join(root, p)))
  process.exit(main(root, paths))
}
