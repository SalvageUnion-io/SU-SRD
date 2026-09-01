/**
 * run-coverage — run every workspace's `test:coverage` and VERIFY each one
 * actually wrote a readable `coverage/lcov.info`, retrying when it silently did
 * not.
 *
 * ## The flake this exists for
 *
 * Bun's coverage run intermittently exits 0, having passed every test, while
 * writing no coverage output at all. When that happens the workspace's whole
 * `coverage/` directory is absent, `coverage-report.ts` scores it `(missing)`,
 * and the ratchet fails the build — on a PR that may not touch that workspace.
 *
 * This is not hypothetical and it is not new. `coverage-report.ts` carries a
 * comment about it costing "a real debugging cycle when apps/srd intermittently
 * reported nothing in CI while its tests passed and exited 0"; the response at
 * the time was to improve the ratchet's error message, not to stop the flake.
 * It has since moved to `apps/itun` — a merge-queue run of #570 (a data-only PR
 * touching no ITUN file) was ejected by it, and a run of #569 before that. The
 * CI log shows the text reporter printing its table header and then nothing:
 * no per-file rows, no "Ran N tests" summary, no lcov — yet exit code 0.
 *
 * It does not reproduce locally, where the same command writes a 331 KB lcov
 * every time, so this is an environment-dependent flush/truncation failure in
 * the reporter rather than anything the repo can fix at the source.
 *
 * ## Why retrying is the right shape, and why it is safe
 *
 * A retry hides a genuine regression only if the regression is intermittent.
 * The failure this guards against — "this workspace has stopped emitting
 * coverage" — is deterministic: a workspace that genuinely cannot write lcov
 * fails EVERY attempt and this script exits non-zero with the workspace named.
 * What the retries absorb is exactly the non-deterministic case, which is the
 * one that carries no signal about the PR under test.
 *
 * The ratchet itself is untouched and still authoritative: this script only
 * ensures the ratchet is fed real numbers rather than a phantom `(missing)`.
 * If coverage genuinely drops, `coverage-report.ts` still fails the build.
 *
 * ## Why the budget is 3 attempts and not 2 (#818)
 *
 * It was one retry, and the reasoning above was used to justify that: both
 * attempts failing was taken as proof of a deterministic fault. **That
 * inference was contradicted twice in one afternoon**, on two workspaces, on
 * PRs that touched neither:
 *
 *   #816  apps/srd   two clean runs, no coverage — re-ran the job, green
 *   #820  apps/itun  two clean runs, no coverage — re-ran the job, green
 *
 * A two-attempt budget whose entire diagnostic value is separating intermittent
 * from deterministic stops separating anything once intermittent failures
 * routinely consume both. Three attempts restores the margin the original
 * argument assumed it had. It does not make the argument stronger — a
 * sufficiently persistent flake would eat three — so the number is a floor to
 * revisit, not a fix.
 *
 * ## The three shapes this has actually taken
 *
 * Recorded because a fix aimed at one of them would miss the others, and
 * because they are the evidence any real repair in the reporter has to explain:
 *
 *   1. no `coverage/` directory at all            (#816, apps/srd)
 *   2. `coverage/` exists, holds no `lcov.info`   (#820, apps/itun)
 *   3. `lcov.info` exists but is EMPTY            — the truncation shape the
 *      header hypothesises; see `wroteCoverage` below
 *
 * Shapes 1 and 2 are both "no readable lcov" and were already caught. Shape 3
 * was NOT: `existsSync` passes on a zero-byte file, so a truncated write would
 * have been handed to the ratchet, scored 0%, and reported as a catastrophic
 * coverage DROP rather than a missing artefact — a far more confusing failure
 * than the one it came from. Checking size closes that.
 */

import { existsSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Workspace directory → its package name (the `bun --filter` target). Order is
 * the run order and mirrors `WORKSPACES` in `coverage-report.ts`; the two lists
 * are asserted to agree by `run-coverage.test.ts`, so a workspace can never be
 * covered here but unscored there (or the reverse).
 */
const WORKSPACES: ReadonlyArray<{ dir: string; filter: string }> = [
  { dir: 'packages/salvageunion-reference', filter: 'salvageunion-reference' },
  { dir: 'packages/component-lib', filter: 'component-lib' },
  { dir: 'apps/srd', filter: 'srd' },
  { dir: 'apps/itun', filter: 'itun' },
  { dir: 'apps/discord-bot', filter: 'discord-bot' },
  { dir: 'apps/su-assets', filter: 'su-assets' },
  { dir: 'packages/observability', filter: 'observability' },
]

const lcovFor = (dir: string) => join(root, dir, 'coverage', 'lcov.info')

/**
 * Did this run produce a coverage file the ratchet can actually read?
 *
 * Size, not just existence — a zero-byte `lcov.info` is shape 3 above, and it
 * is worse than a missing one: the ratchet would parse it as 0% and fail the
 * build for a coverage collapse that never happened.
 */
function wroteCoverage(dir: string): boolean {
  const path = lcovFor(dir)
  if (!existsSync(path)) return false
  return statSync(path).size > 0
}

/**
 * Total attempts per workspace before calling it deterministic. See the note in
 * the header — this is a floor chosen from two observed double-failures, not a
 * number with a theory behind it.
 */
const ATTEMPTS = 3

/** Run one workspace's `test:coverage`. Returns the exit code. */
async function runCoverage(filter: string): Promise<number> {
  const proc = Bun.spawn(['bun', '--filter', filter, 'test:coverage'], {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  return await proc.exited
}

let failed = false

for (const { dir, filter } of WORKSPACES) {
  // Clear any stale lcov first, so "the file exists" can only mean THIS run
  // wrote it. Without this a previous run's artifact would mask a silent
  // no-write on a developer machine.
  rmSync(join(root, dir, 'coverage'), { recursive: true, force: true })

  let testsFailed = false

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const code = await runCoverage(filter)

    // A non-zero exit is a real test failure — report it as such and do NOT
    // retry. Retrying failing tests is how a flaky suite gets normalised.
    if (code !== 0) {
      console.error(
        `\n✗ ${dir}: test:coverage exited ${code} on attempt ${attempt}/${ATTEMPTS} —` +
          ` tests failed.`
      )
      testsFailed = true
      break
    }

    if (wroteCoverage(dir)) {
      if (attempt > 1) console.error(`✓ ${dir}: attempt ${attempt}/${ATTEMPTS} produced coverage.`)
      break
    }

    if (attempt < ATTEMPTS) {
      console.error(
        `\n⚠ ${dir}: test:coverage passed (exit 0) on attempt ${attempt}/${ATTEMPTS} but wrote` +
          ` no readable coverage/lcov.info. This is the known intermittent reporter flake` +
          ` (#818) — retrying.`
      )
      // Clear the partial artefact so the next attempt's result is unambiguous:
      // a truncated file left in place would make attempt N+1's success
      // indistinguishable from attempt N's leftovers.
      rmSync(join(root, dir, 'coverage'), { recursive: true, force: true })
    } else {
      console.error(
        `\n✗ ${dir}: no readable coverage/lcov.info after ${ATTEMPTS} clean runs. Every` +
          ` attempt exited 0 and produced nothing, so this is NOT the intermittent flake —` +
          ` the workspace has stopped emitting coverage and needs fixing at the source.` +
          ` (If this is the flake after all, that is itself the finding: say so on #818,` +
          ` because it means ${ATTEMPTS} attempts is no longer enough either.)`
      )
      failed = true
    }
  }

  if (testsFailed) {
    failed = true
  }
}

if (failed) process.exit(1)
