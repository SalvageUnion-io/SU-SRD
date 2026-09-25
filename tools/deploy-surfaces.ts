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
 * Usage: bun tools/deploy-surfaces.ts [--force-all]
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

function git(args: string[]): { ok: boolean; out: string } {
  const proc = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe' })
  return { ok: proc.exitCode === 0, out: proc.stdout.toString().trim() }
}

/** Files that differ between the recorded deploy and HEAD, or null with no record. */
function changedSinceRecord(): string[] | null {
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
  const diff = git(['diff', '--name-only', base.out, 'HEAD'])
  if (!diff.ok) return null
  return diff.out === '' ? [] : diff.out.split('\n')
}

function main(): void {
  const forceAll = process.argv.includes('--force-all')
  const changed = forceAll ? [] : changedSinceRecord()
  if (forceAll) console.log('force_all — deploying every surface')
  else if (changed === null)
    console.log(`no usable ${DEPLOY_RECORD} record — deploying every surface`)

  const decision = decideSurfaces(changed, forceAll)
  const lines: string[] = []
  for (const [key, deploy] of Object.entries(decision) as [Surface, boolean][]) {
    console.log(`  ${deploy ? 'deploy' : 'skip  '} ${SURFACES[key]}`)
    lines.push(`${key}=${deploy}`)
  }
  const output = process.env.GITHUB_OUTPUT
  if (output) appendFileSync(output, `${lines.join('\n')}\n`)
}

if (import.meta.main) main()
