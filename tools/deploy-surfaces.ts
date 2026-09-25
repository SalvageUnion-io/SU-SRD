#!/usr/bin/env bun
/**
 * deploy-surfaces — decide which Cloudflare surfaces a deploy must ship.
 *
 * Run by `.github/workflows/deploy-cloudflare.yml`. Diffs the tree being
 * deployed (HEAD) against the last SUCCESSFUL deploy, recorded as the
 * `deployed/cloudflare` tag that the workflow's `record` job moves after every
 * green run, and writes `assets|srd|itun|bot=true|false` to $GITHUB_OUTPUT.
 *
 * Why not `HEAD^..HEAD`: that is "the merged PR" only if every commit on main
 * reaches the deploy workflow, and two things stop that — a CI run on main that
 * never goes green fires no successful `workflow_run`, and the deploy
 * concurrency group drops all but one queued run. Either way the next deploy
 * diffed a single commit and left the skipped commit's surface on the old
 * build, with every run green (audit CI-01). A tree diff against the recorded
 * deploy is also right for a rollback dispatch to an OLDER commit.
 *
 * Fails SAFE in every direction: no record, `--force-all`, or any change to a
 * shared path deploys everything. Under-deploying is the only outcome that can
 * serve a stale surface, so nothing here narrows on a guess.
 *
 * NEVER BACKWARDS ON ITS OWN. CI on `main` gives every commit its own run and
 * never cancels one, so two commits' runs can finish in either order. If B
 * (newer) deploys and records first, A's late `workflow_run` would diff B->A
 * and ship A's tree for every surface B touched — reverting B in production —
 * and then move the record back to A. So when HEAD is an ancestor of the
 * recorded deploy the run is STALE: nothing ships and the record job does not
 * run. Only a manual dispatch (`--allow-backwards`, the rollback path) may
 * deploy an older commit and move the record back to it.
 *
 * Usage: bun tools/deploy-surfaces.ts [--force-all] [--allow-backwards]
 * docs/architecture/ci.md, "Deploy set".
 */

import { appendFileSync } from 'node:fs'

const DEPLOY_RECORD = 'deployed/cloudflare'

/** Output key -> the app directory whose changes require that deploy. */
export const SURFACES = {
  assets: 'su-assets',
  srd: 'srd',
  itun: 'itun',
  bot: 'discord-bot',
} as const

type Surface = keyof typeof SURFACES

/**
 * A change under any of these can move every surface, so all of them ship.
 *
 * The three root prose files are rendered INTO srd's about page and bundled
 * `?raw` into ITUN (ci.yml's `shared` filter carries them for the same reason,
 * after #731), so an edit to one changes what those surfaces serve even though
 * nothing under `apps/` moved.
 */
const SHARED =
  /^(packages\/|test\/|package\.json$|bun\.lock$|bunfig\.toml$|tsconfig|patches\/|\.bun-version$|\.github\/|ABOUT_JRVS\.md$|LLM_STATEMENT\.md$|SPECIAL_THANKS\.md$)/

/**
 * The pure decision. `changed === null` means there is no usable deploy record,
 * which deploys everything.
 */
export function decideSurfaces(
  changed: readonly string[] | null,
  forceAll: boolean
): Record<Surface, boolean> {
  const all = forceAll || changed === null || changed.some((path) => SHARED.test(path))
  const result = {} as Record<Surface, boolean>
  for (const [key, dir] of Object.entries(SURFACES) as [Surface, string][]) {
    result[key] = all || (changed ?? []).some((path) => path.startsWith(`apps/${dir}/`))
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
    for (const key of Object.keys(SURFACES) as Surface[]) surfaces[key] = false
    return { stale: true, surfaces }
  }
  return { stale: false, surfaces: decideSurfaces(changed, forceAll) }
}

function git(args: string[]): { ok: boolean; out: string } {
  const proc = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe' })
  return { ok: proc.exitCode === 0, out: proc.stdout.toString().trim() }
}

/** The recorded deploy's commit, or null when there is no usable record. */
function recordedDeploy(): string | null {
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
  console.log(`last recorded deploy: ${base.out}`)
  return base.out
}

function ancestryOf(base: string | null): Ancestry {
  if (base === null) return 'none'
  const head = git(['rev-parse', 'HEAD']).out
  if (head === base) return 'same'
  if (git(['merge-base', '--is-ancestor', 'HEAD', base]).ok) return 'behind'
  if (git(['merge-base', '--is-ancestor', base, 'HEAD']).ok) return 'ahead'
  return 'diverged'
}

/** Files that differ between the recorded deploy and HEAD, or null with no record. */
function changedSince(base: string | null): string[] | null {
  if (base === null) return null
  const diff = git(['diff', '--name-only', base, 'HEAD'])
  if (!diff.ok) return null
  return diff.out === '' ? [] : diff.out.split('\n')
}

function main(): void {
  const forceAll = process.argv.includes('--force-all')
  const allowBackwards = process.argv.includes('--allow-backwards')
  const base = recordedDeploy()
  const ancestry = ancestryOf(base)
  const changed = forceAll ? [] : changedSince(base)

  const plan = planDeploy(changed, forceAll, ancestry, allowBackwards)
  if (plan.stale)
    console.log(
      `HEAD is older than the recorded deploy ${base} — a newer commit already shipped. ` +
        'Deploying nothing and leaving the record alone (dispatch with `sha` to roll back).'
    )
  else if (forceAll) console.log('force_all — deploying every surface')
  else if (changed === null)
    console.log(`no usable ${DEPLOY_RECORD} record — deploying every surface`)

  const lines: string[] = [`stale=${plan.stale}`]
  for (const [key, deploy] of Object.entries(plan.surfaces) as [Surface, boolean][]) {
    console.log(`  ${deploy ? 'deploy' : 'skip  '} ${SURFACES[key]}`)
    lines.push(`${key}=${deploy}`)
  }
  const output = process.env.GITHUB_OUTPUT
  if (output) appendFileSync(output, `${lines.join('\n')}\n`)
}

if (import.meta.main) main()
