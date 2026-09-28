/**
 * The CI test gate: every workspace's `test:coverage` plus the `tools/` suite,
 * run concurrently, each workspace held to a line-coverage floor.
 *
 * The floor applies to the workspace's line-weighted total, LH / LF summed over
 * its lcov (workspace bunfigs ignore `../**`, so the lcov holds only that
 * workspace's files). Bun's `coverageThreshold` cannot express a total: Bun 1.4
 * applies it to every file on its own, and plenty of well-tested workspaces
 * carry individual files far below their total.
 *
 * Workspaces run side by side, but each one's own run stays serial: a parallel
 * Bun coverage run counts lines differently. Output is buffered per job and
 * printed whole, so every failure reads under its workspace's name.
 */

import { $ } from 'bun'
import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { assertCoversWorkspaces } from './lib/workspaceCoverage'

const root = join(import.meta.dir, '..')

/**
 * Minimum line coverage per workspace, in percent. Raise a floor to lock in a
 * gain; lowering one is a decision to state in the PR, not a way to go green.
 */
const FLOORS: Readonly<Record<string, number>> = {
  'packages/salvageunion-reference': 94.5,
  'packages/component-lib': 86.5,
  'apps/srd': 94.5,
  'apps/itun': 88.5,
  'apps/discord-bot': 94.5,
  'apps/su-assets': 80.5,
  'packages/observability': 99.5,
}

assertCoversWorkspaces('coverage floors', Object.keys(FLOORS))

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

type Result = { name: string; ok: boolean; verdict: string }

async function runJob(name: string, command: $.ShellPromise, floor?: number): Promise<Result> {
  const started = performance.now()
  const { exitCode, stdout } = await command.nothrow().quiet()
  const took = `${((performance.now() - started) / 1000).toFixed(1)} s`
  let ok = exitCode === 0
  let verdict = ok ? `tests passed in ${took}` : `TESTS FAILED (exit ${exitCode}) in ${took}`
  if (ok && floor !== undefined) {
    const lcovPath = join(root, name, 'coverage', 'lcov.info')
    const pct = existsSync(lcovPath) ? lineCoverage(readFileSync(lcovPath, 'utf-8')) : undefined
    ok = pct !== undefined && pct >= floor
    verdict =
      pct === undefined
        ? `NO COVERAGE: tests passed in ${took} but coverage/lcov.info holds no lines`
        : `${pct.toFixed(2)}% of lines, floor ${floor}%${ok ? '' : ' (BELOW FLOOR)'}, ${verdict}`
  }
  console.log(`\n━━━━ ${name}: ${verdict} ━━━━\n${stdout.toString().trimEnd()}`)
  return { name, ok, verdict }
}

const results = await Promise.all([
  ...Object.entries(FLOORS).map(([dir, floor]) => {
    // A stale lcov from an earlier run must not stand in for this one.
    rmSync(join(root, dir, 'coverage'), { recursive: true, force: true })
    return runJob(dir, $`bun run test:coverage 2>&1`.cwd(join(root, dir)), floor)
  }),
  runJob('tools', $`bun run test:tools 2>&1`.cwd(root)),
])

const width = Math.max(...results.map((r) => r.name.length))
const summary = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.name.padEnd(width)}  ${r.verdict}`)
console.log(`\n${summary.join('\n')}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  const block = `## Tests and coverage\n\n\`\`\`\n${summary.join('\n')}\n\`\`\`\n`
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, block)
}

if (results.some((r) => !r.ok)) process.exit(1)
