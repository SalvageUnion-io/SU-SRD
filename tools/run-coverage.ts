/**
 * run-coverage — run every workspace's `test:coverage` and VERIFY each one
 * actually wrote its `coverage/lcov.info`, retrying once when it silently did
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
 * ## Why a retry is the right shape, and why it is safe
 *
 * A retry hides a genuine regression only if the regression is intermittent.
 * The failure this guards against — "this workspace has stopped emitting
 * coverage" — is deterministic: a workspace that genuinely cannot write lcov
 * fails BOTH attempts and this script exits non-zero with the workspace named.
 * What the retry absorbs is exactly the non-deterministic case, which is the
 * one that carries no signal about the PR under test.
 *
 * The ratchet itself is untouched and still authoritative: this script only
 * ensures the ratchet is fed real numbers rather than a phantom `(missing)`.
 * If coverage genuinely drops, `coverage-report.ts` still fails the build.
 */

import { existsSync, rmSync } from 'node:fs'
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
]

const lcovFor = (dir: string) => join(root, dir, 'coverage', 'lcov.info')

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

  const code = await runCoverage(filter)

  // A non-zero exit is a real test failure — report it as such and do NOT
  // retry. Retrying failing tests is how a flaky suite gets normalised.
  if (code !== 0) {
    console.error(`\n✗ ${dir}: test:coverage exited ${code} — tests failed.`)
    failed = true
    continue
  }

  if (existsSync(lcovFor(dir))) continue

  console.error(
    `\n⚠ ${dir}: test:coverage passed (exit 0) but wrote no coverage/lcov.info.` +
      ` This is the known intermittent reporter flake — retrying once.`
  )

  const retryCode = await runCoverage(filter)
  if (retryCode !== 0) {
    console.error(`\n✗ ${dir}: retry exited ${retryCode} — tests failed on the second attempt.`)
    failed = true
    continue
  }

  if (!existsSync(lcovFor(dir))) {
    console.error(
      `\n✗ ${dir}: still no coverage/lcov.info after a retry. Two clean runs produced` +
        ` no coverage, so this is NOT the intermittent flake — the workspace has stopped` +
        ` emitting coverage and needs fixing at the source.`
    )
    failed = true
    continue
  }

  console.error(`✓ ${dir}: retry produced coverage.`)
}

if (failed) process.exit(1)
