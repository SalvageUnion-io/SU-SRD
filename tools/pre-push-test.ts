/**
 * Pre-push's test step: the suites of the workspaces this branch changed, plus
 * every workspace that depends on them, with no coverage.
 *
 * Coverage floors are CI's job (`test:coverage`, `run-coverage.ts`). Pre-push
 * used to run that same gate whenever shared code moved, which on a branch off
 * `packages/` meant every push: 97 s against CI's 88 s, beside the pre-push
 * checks on four cores. The contention pushed renders past Bun's 5 s default,
 * and #1343 records three refused pushes and a 1.6 s test given a 30 s budget to get
 * through. A plain run of each workspace's own `test` script (every one is
 * `--parallel=4 --no-isolate`) holds the default budgets.
 *
 * Selection is by workspace graph (`lib/workspaceGraph.ts`), not Bun's
 * `--changed`, which does not cross workspace boundaries. The diff starts at
 * the merge-base with the branch this one merges into (`lib/baseBranch.ts`:
 * `$SU_BASE`, the open PR's base, the upstream, else the nearer of main and
 * design-refresh), so the whole branch counts, not just the last commit, and a
 * branch off design-refresh is not charged with design-refresh's diff against
 * main. No base runs every workspace, never none.
 *
 *   bun tools/pre-push-test.ts            run the selection
 *   bun tools/pre-push-test.ts --dry-run  print it and exit
 */

import { $ } from 'bun'
import { join } from 'node:path'
import { describeBase, resolveBaseBranch } from 'gates/lib/baseBranch'
import { readWorkspaces, selectWorkspaces } from 'gates/lib/workspaceGraph'

const root = join(import.meta.dir, '..')

const base = await resolveBaseBranch({ cwd: root })

async function changedFiles(): Promise<string[] | null> {
  if (!base) return null
  const mergeBase = await $`git merge-base HEAD ${base.ref}`.cwd(root).nothrow().quiet()
  if (mergeBase.exitCode !== 0) return null
  // Against the working tree, as before: an uncommitted edit still counts.
  const diff = await $`git diff --name-only ${mergeBase.text().trim()}`.cwd(root).quiet()
  return diff.text().split('\n').filter(Boolean)
}

const changed = await changedFiles()
const workspaces = readWorkspaces()
const selected = selectWorkspaces(changed, workspaces)

if (changed === null) {
  const missing = base ? `no ${base.ref} to diff against` : 'no base branch found'
  console.log(`pre-push: ${missing} — every workspace`)
} else if (base) {
  console.log(`pre-push: diffing against ${base.ref} (${describeBase(base)})`)
}
if (selected.length === 0) {
  console.log('pre-push: no workspace changed — no tests to run')
  process.exit(0)
}
console.log(`pre-push: testing ${selected.join(', ')} (changed workspaces and their dependents)`)
if (process.argv.includes('--dry-run')) process.exit(0)

// One workspace at a time: srd, itun and component-lib each fill four workers,
// so running them side by side (as `bun --filter` does) oversubscribes the
// cores and pushes renders past the 5 s default — the contention this replaced.
const failed: string[] = []
for (const ws of workspaces.filter((w) => selected.includes(w.name))) {
  console.log(`\npre-push: ${ws.name}`)
  const { exitCode } = await $`bun run test`.cwd(join(root, ws.dir)).nothrow()
  if (exitCode !== 0) failed.push(ws.name)
}
if (failed.length > 0) {
  console.error(`\npre-push: tests failed in ${failed.join(', ')}`)
  process.exit(1)
}
