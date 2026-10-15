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
 *
 * A workspace in `PARTS` is gated per folder instead: each part runs only its
 * own test files and is held to its own floor over only its own files. `apps/web`
 * holds srd and the Cantina, each at the floor it had as a workspace of its own.
 */

import { $ } from 'bun'
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { functionRanges } from 'gates/lib/functionRanges'
import { mergeLcov } from 'gates/lib/lcov'
import { assertCoversWorkspaces } from 'gates/lib/workspaceCoverage'

/**
 * Minimum line coverage per workspace, in percent. Raise a floor to lock in a
 * gain; lowering one is a decision to state in the PR, not a way to go green.
 */
const FLOORS: Readonly<Record<string, number>> = {
  'packages/salvageunion-reference': 96.5,
  'packages/component-lib': 95.5,
  'apps/web (srd)': 99,
  'apps/web (cantina)': 97,
  'apps/discord-bot': 96.5,
  'apps/su-assets': 98,
  'packages/observability': 99.5,
  'packages/cantina-domain': 97,
  'packages/gates': 99,
  tools: 99,
}

/**
 * Serial coverage processes per workspace, for the suites long enough to be the
 * CI critical path. Any workspace left out runs as one process.
 */
const SHARDS: Readonly<Record<string, number>> = {
  'apps/web (cantina)': 3,
}

/** A per-folder job: the workspace it runs in, and which paths in it are its own. */
type Part = { dir: string; owns: (path: string) => boolean }

/** The Cantina's paths in `apps/web`, relative to it: its app, backend, tests and tooling. */
const CANTINA =
  /^(src\/cantina\/|convex\/|test\/|e2e\/cantina\/|scripts\/(__tests__\/)?(assert-local-convex|generate-route-tree)\.|routeTree\.config\.|[a-z]+\.cantina\.config\.)/

/** Jobs that gate one folder of a workspace; any job not listed runs its whole workspace. */
const PARTS: Readonly<Record<string, Part>> = {
  'apps/web (srd)': { dir: 'apps/web', owns: (path) => !CANTINA.test(path) },
  'apps/web (cantina)': { dir: 'apps/web', owns: (path) => CANTINA.test(path) },
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
export function shardTestFiles(
  cwd: string,
  count: number,
  owns: (path: string) => boolean = () => true
): string[][] {
  const files = [...TEST_FILES.scanSync({ cwd })]
    .filter(
      (path) => !path.split('/').some((part) => part === 'node_modules' || part.startsWith('.'))
    )
    .filter(owns)
    .sort()
  return Array.from({ length: count }, (_, shard) =>
    files.filter((_, i) => i % count === shard).map((path) => `./${path}`)
  )
}

/** Only the lcov records whose source file `owns` accepts. */
export function lcovFor(lcov: string, owns: (path: string) => boolean): string {
  return lcov
    .split(/^(?=TN:)/m)
    .filter((record) => {
      const source = record.match(/^SF:(.*)$/m)?.[1]
      return source !== undefined && owns(source)
    })
    .join('')
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

/** A file's text, or undefined when there is none: one read, no separate existence check. */
function readIfPresent(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

type Result = { name: string; ok: boolean; verdict: string; output: string }

/** Where a job runs, and the `bun` it runs (a stub, in the script's tests). */
export type JobOptions = { root: string; shards?: number; bun?: readonly string[]; part?: Part }

/** One workspace's coverage run (or its shards, merged) against its floor. */
export async function runJob(name: string, floor: number, options: JobOptions): Promise<Result> {
  const { root, shards: shardCount = 1, bun = ['bun'], part } = options
  const cwd = join(root, part?.dir ?? name)
  // A part writes under its own folder, so two parts of one workspace never
  // read each other's lcov.
  const coverage = part ? join('coverage', name.replace(/\W+/g, '-')) : 'coverage'
  // A stale lcov from an earlier run must not stand in for this one.
  rmSync(join(cwd, coverage), { recursive: true, force: true })
  const started = performance.now()
  const runs =
    shardCount === 1 && !part
      ? [$`${bun} test ${coverageArgs(coverage)} 2>&1`.cwd(cwd).nothrow().quiet()]
      : shardTestFiles(cwd, shardCount, part?.owns).map((files, i) =>
          $`${bun} test ${coverageArgs(shardCount === 1 ? coverage : `${coverage}/shard-${i + 1}`)} ${files} 2>&1`
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
    const reports = outputs.map((_, i) => join(cwd, coverage, `shard-${i + 1}`, 'lcov.info'))
    if (reports.every((path) => existsSync(path))) {
      const merged = mergeLcov(
        reports.map((path) => readFileSync(path, 'utf-8')),
        (source) => functionRanges(join(cwd, source))
      )
      writeFileSync(join(cwd, coverage, 'lcov.info'), merged)
    }
  }
  const lcovPath = join(cwd, coverage, 'lcov.info')
  let lcov = ok ? readIfPresent(lcovPath) : undefined
  if (lcov !== undefined && part) {
    lcov = lcovFor(lcov, part.owns)
    writeFileSync(lcovPath, lcov)
  }
  if (ok) {
    const pct = lcov === undefined ? undefined : lineCoverage(lcov)
    ok = pct !== undefined && pct >= floor
    verdict =
      pct === undefined
        ? `NO COVERAGE: tests passed in ${took} but coverage/lcov.info holds no lines`
        : `${pct.toFixed(2)}% of lines, floor ${floor}%${ok ? '' : ' (BELOW FLOOR)'}, ${verdict}`
  }
  return { name, ok, verdict, output: `\n━━━━ ${name}: ${verdict} ━━━━\n${stdout.trimEnd()}` }
}

/** What `main` runs and where it reports; the defaults are the repo's and CI's. */
export type CoverageOptions = {
  floors?: Readonly<Record<string, number>>
  shards?: Readonly<Record<string, number>>
  parts?: Readonly<Record<string, Part>>
  root?: string
  bun?: readonly string[]
  /** Fails when a workspace has no floor (every workspace must be gated). */
  coversWorkspaces?: (names: string[]) => void
  /** GitHub's job summary file, when set. */
  summaryPath?: string
  log?: (text: string) => void
}

/** Every workspace's suite against its floor; returns the exit code. */
export async function main({
  floors = FLOORS,
  shards = SHARDS,
  parts = PARTS,
  root = join(import.meta.dir, '..'),
  bun,
  coversWorkspaces = (names) => assertCoversWorkspaces('coverage floors', names),
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
  log = console.log,
}: CoverageOptions = {}): Promise<number> {
  coversWorkspaces([...new Set(Object.keys(floors).map((name) => parts[name]?.dir ?? name))])
  const results = await Promise.all(
    Object.entries(floors).map(async ([name, floor]) => {
      const result = await runJob(name, floor, {
        root,
        shards: shards[name],
        bun,
        part: parts[name],
      })
      log(result.output)
      return result
    })
  )
  const width = Math.max(...results.map((r) => r.name.length))
  const summary = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.name.padEnd(width)}  ${r.verdict}`)
  log(`\n${summary.join('\n')}`)
  if (summaryPath) {
    const block = `## Tests and coverage\n\n\`\`\`\n${summary.join('\n')}\n\`\`\`\n`
    appendFileSync(summaryPath, block)
  }
  return results.some((r) => !r.ok) ? 1 : 0
}

if (import.meta.main) process.exit(await main())
