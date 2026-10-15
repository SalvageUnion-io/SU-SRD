#!/usr/bin/env bun
/**
 * deploy-surfaces — decide which Cloudflare surfaces a deploy must ship.
 *
 * Run by `.github/workflows/deploy-cloudflare.yml`. Diffs the tree being
 * deployed (HEAD) against the last SUCCESSFUL deploy, recorded as the
 * `deployed/cloudflare` tag that the workflow's `record` job moves after every
 * green run, and writes `stale=true|false` and `deploy=<JSON array of app
 * directories>` (the deploy job's matrix) to $GITHUB_OUTPUT.
 *
 * Why not `HEAD^..HEAD`: that is "the merged PR" only if every commit on main
 * gets its own deploy, and two things stop that — a deploy that fails, and the
 * deploy concurrency group, which drops all but one queued run. Either way the
 * next deploy diffed a single commit and left the skipped commit's surface on
 * the old build, with every run green. A tree diff against the recorded
 * deploy is also right for a rollback dispatch to an OLDER commit.
 *
 * Fails SAFE in every direction: no record, `--force-all`, or any change to a
 * shared path deploys everything. Under-deploying is the only outcome that can
 * serve a stale surface, so nothing here narrows the shared set.
 *
 * NEVER BACKWARDS ON ITS OWN. A re-run of an older merge's deploy can start
 * after a newer one shipped. If B (newer) deploys and records first, A's late
 * run would diff B->A and ship A's tree for every surface B touched — reverting
 * B in production — and then move the record back to A. So when HEAD is an ancestor of the
 * recorded deploy the run is STALE: nothing ships and the record job does not
 * run. Only a manual dispatch (`--allow-backwards`, the rollback path) may
 * deploy an older commit and move the record back to it.
 *
 * Usage: bun tools/deploy-surfaces.ts [--force-all] [--allow-backwards]
 * docs/ARCHITECTURE.md#deploy.
 */

import { appendFileSync } from 'node:fs'
import { WORKERS } from './check-workers'

const DEPLOY_RECORD = 'deployed/cloudflare'

/**
 * The surfaces, each one Worker app and named by its directory under `apps/`
 * (the deploy job's matrix entry): a change under `apps/<app>/` ships that
 * surface alone. `web` is the whole site, the reference and the Cantina under
 * `/build`, as one Worker.
 */
export const SURFACES = WORKERS.map(({ app }) => app)

type Surface = (typeof SURFACES)[number]

/**
 * A change under any of these can move every surface, so all of them ship.
 * An entry ending in `/` or `*` is a prefix; any other is one exact path.
 *
 * The three root prose files are rendered INTO the about page and bundled
 * `?raw` into the Cantina (ci.yml's `shared` filter carries them for the same
 * reason), so an edit to one changes what those surfaces serve even though
 * nothing under `apps/` moved. Of `.github/`, only this deploy's own workflow
 * and the actions its jobs run can change what ships. Every entry but
 * `packages/` (which ci.yml filters per app) is in ci.yml's `shared` filter
 * too, so what redeploys every surface was tested against every app:
 * tools/check-workflows.ts (path-filters) holds the two lists together.
 */
export const SHARED_PATHS = [
  'packages/',
  'package.json',
  'bun.lock',
  'bunfig.toml',
  'tsconfig*',
  '.github/workflows/deploy-cloudflare.yml',
  '.github/actions/',
  'ABOUT_JRVS.md',
  'LLM_STATEMENT.md',
  'SPECIAL_THANKS.md',
] as const

/** Does `path` fall under one of `SHARED_PATHS`? */
export function isShared(path: string): boolean {
  return SHARED_PATHS.some((entry) =>
    entry.endsWith('/') || entry.endsWith('*')
      ? path.startsWith(entry.replace(/\*$/, ''))
      : path === entry
  )
}

/**
 * The pure decision. `changed === null` means there is no usable deploy record,
 * which deploys everything.
 */
export function decideSurfaces(
  changed: readonly string[] | null,
  forceAll: boolean
): Record<Surface, boolean> {
  const all = forceAll || changed === null || changed.some(isShared)
  const result = {} as Record<Surface, boolean>
  for (const app of SURFACES) {
    result[app] = all || (changed ?? []).some((path) => path.startsWith(`apps/${app}/`))
  }
  return result
}

/**
 * Where HEAD sits relative to the recorded deploy. `behind` means HEAD is a
 * strict ancestor of the record — an older commit than what is live.
 */
export type Ancestry = 'none' | 'same' | 'ahead' | 'behind' | 'diverged'

export type DeployPlan = {
  /** HEAD is older than the recorded deploy and backwards moves are not allowed. */
  stale: boolean
  surfaces: Record<Surface, boolean>
}

/**
 * The full decision: `decideSurfaces`, unless the run is stale. A stale run
 * deploys nothing even under `--force-all`, because `force_all` is a dispatch
 * input and every dispatch also passes `allowBackwards`.
 */
export function planDeploy(
  changed: readonly string[] | null,
  forceAll: boolean,
  ancestry: Ancestry,
  allowBackwards: boolean
): DeployPlan {
  if (ancestry === 'behind' && !allowBackwards) {
    const surfaces = {} as Record<Surface, boolean>
    for (const app of SURFACES) surfaces[app] = false
    return { stale: true, surfaces }
  }
  return { stale: false, surfaces: decideSurfaces(changed, forceAll) }
}

/** Where the git commands run and what they inherit; the defaults are the process's. */
export type GitContext = { cwd?: string; env?: Record<string, string | undefined> }

type Git = (args: string[]) => { ok: boolean; out: string }

const gitIn =
  ({ cwd, env }: GitContext): Git =>
  (args) => {
    const proc = Bun.spawnSync(['git', ...args], { cwd, env, stdout: 'pipe', stderr: 'pipe' })
    return { ok: proc.exitCode === 0, out: proc.stdout.toString().trim() }
  }

/** The recorded deploy's commit, or null when there is no usable record. */
function recordedDeploy(git: Git, log: (line: string) => void): string | null {
  const fetched = git([
    'fetch',
    '--no-tags',
    '--quiet',
    'origin',
    `+refs/tags/${DEPLOY_RECORD}:refs/tags/${DEPLOY_RECORD}`,
  ])
  if (!fetched.ok) return null
  const base = git(['rev-parse', `refs/tags/${DEPLOY_RECORD}^{commit}`])
  if (!base.ok) return null
  log(`last recorded deploy: ${base.out}`)
  return base.out
}

function ancestryOf(git: Git, base: string | null): Ancestry {
  if (base === null) return 'none'
  const head = git(['rev-parse', 'HEAD']).out
  if (head === base) return 'same'
  if (git(['merge-base', '--is-ancestor', 'HEAD', base]).ok) return 'behind'
  if (git(['merge-base', '--is-ancestor', base, 'HEAD']).ok) return 'ahead'
  return 'diverged'
}

/** Files that differ between the recorded deploy and HEAD, or null with no record. */
function changedSince(git: Git, base: string | null): string[] | null {
  if (base === null) return null
  const diff = git(['diff', '--name-only', base, 'HEAD'])
  if (!diff.ok) return null
  if (diff.out === '') return []
  return diff.out.split('\n')
}

/** Decide and report the deploy for the checkout at `context.cwd`; writes `$GITHUB_OUTPUT`. */
export function main(
  argv: readonly string[] = process.argv,
  context: GitContext = {},
  log: (line: string) => void = console.log
): void {
  const git = gitIn(context)
  const forceAll = argv.includes('--force-all')
  const allowBackwards = argv.includes('--allow-backwards')
  const base = recordedDeploy(git, log)
  const ancestry = ancestryOf(git, base)
  const changed = forceAll ? [] : changedSince(git, base)

  const plan = planDeploy(changed, forceAll, ancestry, allowBackwards)
  if (plan.stale)
    log(
      `HEAD is older than the recorded deploy ${base} — a newer commit already shipped. ` +
        'Deploying nothing and leaving the record alone (dispatch with `sha` to roll back).'
    )
  else if (forceAll) log('force_all — deploying every surface')
  else if (changed === null) log(`no usable ${DEPLOY_RECORD} record — deploying every surface`)

  const ship: string[] = []
  for (const [app, deploy] of Object.entries(plan.surfaces) as [Surface, boolean][]) {
    log(`  ${deploy ? 'deploy' : 'skip  '} ${app}`)
    if (deploy) ship.push(app)
  }
  const output = (context.env ?? process.env).GITHUB_OUTPUT
  if (output) appendFileSync(output, `stale=${plan.stale}\ndeploy=${JSON.stringify(ship)}\n`)
}

if (import.meta.main) main()
