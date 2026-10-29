#!/usr/bin/env bun

/**
 * check-test-layout — one test layout and one test script
 * (`bun run check test-layout`).
 *
 * There were once two layouts: the app kept ~233 tests in `__tests__/` and ~41
 * beside its Convex harness, the reference package kept all ~56 beside their
 * subjects. There were also two `test` scripts:
 * `bun test` in seven workspaces, `bun test --parallel=4 --no-isolate` in
 * three. This gate fails when either comes back:
 *
 *   1. a `*.test.ts(x)` with no `__tests__` directory in its path. Tests live
 *      in a `__tests__/` beside their subject;
 *   2. a file `bun test` runs (`TEST_FILES`, its default name patterns:
 *      `.spec`, `_test`, `.mts`, …) that is not a `*.test.ts(x)`: Bun would run
 *      it, while this gate, the testing rule's `paths:` and Biome's test-only
 *      rules would not see it;
 *   3. a workspace whose `test` script is not `TEST_SCRIPT`. Bun reads neither
 *      flag from `bunfig.toml`, so they live in the script. Each workspace's
 *      bunfig owns its preloads; the root bunfig has no `[test]` section.
 *
 * No baseline: both counts were zero when the gate landed.
 *
 * Usage: bun tools/check-test-layout.ts
 */

import { $ } from 'bun'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assertScanFloor } from 'gates/lib/scanFloor'
import { readManifests } from 'gates/lib/workspaceGraph'
import { TEST_FILES } from './run-coverage'

/** ~65% of today's count (544 test files): a catastrophe floor. */
const TEST_FLOOR = 350

const TEST_FILE = /\.test\.tsx?$/

/**
 * Every workspace's `test` script, the inner loop. `--parallel=N --no-isolate`
 * measured faster than serial; bare `--parallel` (it implies `--isolate`)
 * measured slower. Files share a process differently here than in CI's serial
 * run, and the suite is not order-free, so the root `bun run test` runs CI's
 * gate itself (`run-coverage.ts`): that verdict is the one that merges.
 */
export const TEST_SCRIPT = 'bun test --parallel=4 --no-isolate'

/** Test files whose path has no `__tests__` directory. */
export function siblingTests(paths: readonly string[]): string[] {
  return paths.filter((p) => TEST_FILE.test(p) && !p.split('/').includes('__tests__'))
}

/** Files Bun runs as tests that are not named `*.test.ts(x)`. */
export function strayTests(paths: readonly string[]): string[] {
  return paths.filter((p) => TEST_FILES.match(p) && !TEST_FILE.test(p))
}

export type TestScript = { dir: string; script: string | undefined }

/** Every workspace manifest's `test` script: `apps/*`, `packages/*` and `tools`. */
export function workspaceTestScripts(root: string): TestScript[] {
  return readManifests(root, { withTools: true }).map(({ dir, manifest }) => ({
    dir,
    script: manifest.scripts?.test,
  }))
}

/** Workspaces whose `test` script is set and is not `TEST_SCRIPT`, one problem per line. */
export function scriptDrift(scripts: readonly TestScript[]): string[] {
  return scripts
    .filter(({ script }) => script !== undefined && script !== TEST_SCRIPT)
    .map(({ dir, script }) => `${dir}/package.json's test script is "${script}"`)
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
  const scripts = workspaceTestScripts(root)
  const problems = [
    ...siblingTests(tests).map((p) => `${p} is outside a __tests__/ directory`),
    ...strayTests(paths).map((p) => `${p} is a file bun test runs; name it *.test.ts(x)`),
    ...scriptDrift(scripts),
  ]
  if (problems.length > 0) {
    error(`check-test-layout: ${problems.length} problem(s):`)
    for (const p of problems) error(`  ${p}`)
    return 1
  }
  log(
    `check-test-layout: ${tests.length} test files sit in __tests__/; ${scripts.length} workspaces test with \`${TEST_SCRIPT}\``
  )
  return 0
}

/**
 * Repo-relative paths that exist: tracked and untracked-but-not-ignored, so a
 * new test fails before it is committed.
 */
export async function listedPaths(root = join(import.meta.dir, '..')): Promise<string[]> {
  const listed = await $`git ls-files --cached --others --exclude-standard`.cwd(root).text()
  return listed.split('\n').filter((p) => p && existsSync(join(root, p)))
}

if (import.meta.main) process.exit(main(join(import.meta.dir, '..'), await listedPaths()))
