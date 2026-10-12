/**
 * The CI test gate: every workspace's suite under `bun test --coverage`, run
 * concurrently, each workspace held to a line-coverage floor.
 *
 * The floor applies to the workspace's line-weighted total, LH / LF summed over
 * its lcov (workspace bunfigs ignore `../**`, so the lcov holds only that
 * workspace's files). Bun's `coverageThreshold` cannot express a total: Bun 1.4
 * applies it to every file on its own, and plenty of well-tested workspaces
 * carry individual files far below their total.
 *
 * Workspaces run side by side, but each Bun process stays serial: a parallel
 * (`--parallel`) Bun coverage run counts lines differently. A workspace in
 * `SHARDS` instead splits its test files across that many serial processes, run
 * at once, and merges their lcov (`lib/lcov.ts`) back to what one serial run
 * reports, line for line; the floor applies to the merge. Output is buffered per job and printed whole, so every failure
 * reads under its workspace's name.
 */

import { $ } from 'bun'
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { functionRanges } from './lib/functionRanges'
import { mergeLcov } from './lib/lcov'
import { assertCoversWorkspaces } from './lib/workspaceCoverage'

/**
 * Minimum line coverage per workspace, in percent. Raise a floor to lock in a
 * gain; lowering one is a decision to state in the PR, not a way to go green.
 */
const FLOORS: Readonly<Record<string, number>> = {
  'packages/salvageunion-reference': 96,
  'packages/component-lib': 92.5,
  'apps/srd': 96.5,
  'apps/itun': 91.5,
  'apps/discord-bot': 95,
  'apps/su-assets': 89.5,
  'packages/observability': 99.5,
  tools: 82.5,
}

/**
 * Serial coverage processes per workspace, for the suites long enough to be the
 * CI critical path. Any workspace left out runs as one process.
 */
const SHARDS: Readonly<Record<string, number>> = {
  'apps/itun': 3,
}

/** One instrumented run, the same in every workspace, so no manifest repeats it. */
const coverageArgs = (dir: string) => [
  '--coverage',
  '--coverage-reporter=text',
  '--coverage-reporter=lcov',
  `--coverage-dir=${dir}`,
]

/** The files `bun test` finds on its own (its default name patterns). */
const TEST_FILES = new Bun.Glob('**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}')

/**
 * A workspace's test files dealt round-robin, in path order, into `count`
 * groups, as `./`-relative paths so `bun test` reads them as files rather than
 * name filters. The deal is fixed because the suite is not order-free: some
 * files leave state that changes what a later file executes, so a different
 * grouping can cover different lines. This one was checked line for line
 * against a single serial run (the PR that introduced it shows the diff);
 * re-check before changing it or a shard count.
 */
export function shardTestFiles(cwd: string, count: number): string[][] {
  const files = [...TEST_FILES.scanSync({ cwd })]
    .filter(
      (path) => !path.split('/').some((part) => part === 'node_modules' || part.startsWith('.'))
    )
    .sort()
  return Array.from({ length: count }, (_, shard) =>
    files.filter((_, i) => i % count === shard).map((path) => `./${path}`)
  )
}

/** Line coverage from lcov text, or undefined when it records no lines. */
function lineCoverage(lcov: string): number | undefined {
  let found = 0
  let hit = 0
  for (const [, kind, count] of lcov.matchAll(/^L([FH]):(\d+)$/gm)) {
    if (kind === 'F') found += Number(count)
    else hit += Number(count)
  }
  return found > 0 ? (hit / found) * 100 : undefined
}

type Result = { name: string; ok: boolean; verdict: string; output: string }

/** Where a job runs, and the `bun` it runs (a stub, in the script's tests). */
export type JobOptions = { root: string; shards?: number; bun?: readonly string[] }

/** One workspace's coverage run (or its shards, merged) against its floor. */
export async function runJob(name: string, floor: number, options: JobOptions): Promise<Result> {
  const { root, shards: shardCount = 1, bun = ['bun'] } = options
  // A stale lcov from an earlier run must not stand in for this one.
  rmSync(join(root, name, 'coverage'), { recursive: true, force: true })
  const cwd = join(root, name)
  const started = performance.now()
  const runs =
    shardCount === 1
      ? [$`${bun} test ${coverageArgs('coverage')} 2>&1`.cwd(cwd).nothrow().quiet()]
      : shardTestFiles(cwd, shardCount).map((files, i) =>
          $`${bun} test ${coverageArgs(`coverage/shard-${i + 1}`)} ${files} 2>&1`
            .cwd(cwd)
            .nothrow()
            .quiet()
        )
  const outputs = await Promise.all(runs)
  const took = `${((performance.now() - started) / 1000).toFixed(1)} s`
  const failed = outputs.find((run) => run.exitCode !== 0)
  const stdout =
    shardCount === 1
      ? (outputs[0]?.stdout.toString() ?? '')
      : outputs
          .map((run, i) => `── shard ${i + 1}/${shardCount} ──\n${run.stdout.toString().trimEnd()}`)
          .join('\n')
  let ok = failed === undefined
  let verdict = failed
    ? `TESTS FAILED (exit ${failed.exitCode}) in ${took}`
    : `tests passed in ${took}${shardCount > 1 ? ` (${shardCount} shards)` : ''}`
  if (ok && shardCount > 1) {
    const reports = outputs.map((_, i) => join(cwd, 'coverage', `shard-${i + 1}`, 'lcov.info'))
    if (reports.every((path) => existsSync(path))) {
      const merged = mergeLcov(
        reports.map((path) => readFileSync(path, 'utf-8')),
        (source) => functionRanges(join(cwd, source))
      )
      writeFileSync(join(cwd, 'coverage', 'lcov.info'), merged)
    }
  }
  if (ok) {
    const lcovPath = join(cwd, 'coverage', 'lcov.info')
    const pct = existsSync(lcovPath) ? lineCoverage(readFileSync(lcovPath, 'utf-8')) : undefined
    ok = pct !== undefined && pct >= floor
    verdict =
      pct === undefined
        ? `NO COVERAGE: tests passed in ${took} but coverage/lcov.info holds no lines`
        : `${pct.toFixed(2)}% of lines, floor ${floor}%${ok ? '' : ' (BELOW FLOOR)'}, ${verdict}`
  }
  return { name, ok, verdict, output: `\n━━━━ ${name}: ${verdict} ━━━━\n${stdout.trimEnd()}` }
}

async function main(): Promise<void> {
  assertCoversWorkspaces('coverage floors', Object.keys(FLOORS))
  const root = join(import.meta.dir, '..')
  const results = await Promise.all(
    Object.entries(FLOORS).map(async ([dir, floor]) => {
      const result = await runJob(dir, floor, { root, shards: SHARDS[dir] })
      console.log(result.output)
      return result
    })
  )
  const width = Math.max(...results.map((r) => r.name.length))
  const summary = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.name.padEnd(width)}  ${r.verdict}`)
  console.log(`\n${summary.join('\n')}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    const block = `## Tests and coverage\n\n\`\`\`\n${summary.join('\n')}\n\`\`\`\n`
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, block)
  }
  if (results.some((r) => !r.ok)) process.exit(1)
}

if (import.meta.main) await main()
