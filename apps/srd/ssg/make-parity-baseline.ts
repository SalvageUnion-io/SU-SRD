/**
 * make-parity-baseline — rebuild the Astro baseline that `ssg/parity.ts` diffs
 * against.
 *
 * ## Why this exists
 *
 * `parity.ts` is the acceptance gate for the Astro -> in-house-SSG migration: it
 * compares the built `dist` semantically (head metadata, JSON-LD, `<main>` text,
 * all 899 JSON endpoints, `llms.txt`) against a build of the LAST Astro commit.
 *
 * That baseline is ~56 MB, so it is gitignored rather than committed — which
 * meant that in practice it existed only on the machine that first produced it.
 * Everywhere else the documented "acceptance gate" was simply unavailable, and
 * `parity.ts` exited 2 with "baseline directory does not exist". A gate nobody
 * can run is not a gate.
 *
 * The baseline is not precious, though: it is a pure function of a commit that
 * is still in history. This script reproduces it on demand, which is strictly
 * better than committing 56 MB of build output.
 *
 * ## Usage
 *
 *   bun ssg/make-parity-baseline.ts [--out <dir>] [--keep-worktree]
 *
 * Then run the gate:
 *
 *   bun ssg/build.ts && bun ssg/parity.ts
 *
 * ## How the baseline commit is found
 *
 * Not hardcoded — it is derived. `apps/srd/astro.config.mjs` was deleted by the
 * migration commit, so the last commit that still HAD Astro is that deletion
 * commit's first parent. If someone ever reintroduces and re-deletes an Astro
 * config this resolves to the newer deletion, which is the correct answer for
 * "the last commit that built with Astro" anyway.
 *
 * ## Cost and caveats
 *
 * It checks out a detached worktree at that commit and runs the Astro-era
 * install (~2,200 packages) and build. That is minutes, not seconds, and it
 * needs network access for the install. It is therefore a developer/CI-on-demand
 * tool, deliberately NOT wired into `check:all`.
 *
 * The build is run through `bunx --bun astro build`, matching what that commit's
 * own `build` script did.
 */

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srdDir = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const DEFAULT_OUT = join(srdDir, '.parity-baseline')

const ASTRO_CONFIG = 'apps/srd/astro.config.mjs'

function git(args: string[], cwd = repoRoot): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim()
}

function run(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

/** The last commit whose tree still contained an Astro config. */
function resolveBaselineCommit(): string {
  const deletion = git(['log', '--diff-filter=D', '--format=%H', '-1', '--', ASTRO_CONFIG])
  if (!deletion) {
    throw new Error(
      `Could not find the commit that deleted ${ASTRO_CONFIG}. If the migration ` +
        'commit has been rewritten out of history, pass a baseline directory to ' +
        'parity.ts directly (--baseline / SRD_PARITY_BASELINE) instead.'
    )
  }
  const parent = git(['rev-parse', `${deletion}^`])
  // Guard against a rewrite that leaves the parent without the config: the
  // build below would fail confusingly ("astro: command not found") instead.
  const tree = git(['ls-tree', '--name-only', parent, ASTRO_CONFIG])
  if (tree !== ASTRO_CONFIG) {
    throw new Error(
      `${parent} does not contain ${ASTRO_CONFIG}, so it cannot build the Astro baseline.`
    )
  }
  return parent
}

function main(): void {
  const argv = process.argv.slice(2)
  let out = DEFAULT_OUT
  let keepWorktree = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') {
      const next = argv[++i]
      if (!next) throw new Error('--out requires a directory')
      out = next
    } else if (argv[i] === '--keep-worktree') {
      keepWorktree = true
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
      console.log('usage: bun ssg/make-parity-baseline.ts [--out <dir>] [--keep-worktree]')
      return
    } else {
      throw new Error(`unknown argument: ${argv[i]}`)
    }
  }

  const commit = resolveBaselineCommit()
  // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
  console.log(`[baseline] last Astro commit: ${commit}`)

  const workdir = mkdtempSync(join(tmpdir(), 'srd-parity-baseline-'))
  const checkout = join(workdir, 'checkout')

  try {
    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log(`[baseline] checking out ${commit} -> ${checkout}`)
    run('git', ['worktree', 'add', '--detach', checkout, commit], repoRoot)

    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log('[baseline] installing Astro-era dependencies (this is the slow part)')
    run('bun', ['install', '--frozen-lockfile'], checkout)

    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log('[baseline] building salvageunion-reference')
    run('bun', ['run', 'build:package'], checkout)

    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log('[baseline] running astro build')
    run('bunx', ['--bun', 'astro', 'build'], join(checkout, 'apps', 'srd'))

    const built = join(checkout, 'apps', 'srd', 'dist')
    if (!existsSync(built)) {
      throw new Error(`astro build produced no dist at ${built}`)
    }

    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log(`[baseline] copying dist -> ${out}`)
    rmSync(out, { recursive: true, force: true })
    cpSync(built, out, { recursive: true })

    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log('[baseline] done. Now run:  bun ssg/build.ts && bun ssg/parity.ts')
  } finally {
    if (keepWorktree) {
      // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
      console.log(`[baseline] keeping worktree at ${checkout}`)
    } else {
      // `git worktree remove` also drops the administrative entry, which a bare
      // rm of the temp dir would leave behind as a stale `git worktree list` row.
      try {
        run('git', ['worktree', 'remove', '--force', checkout], repoRoot)
      } catch {
        console.warn(`[baseline] could not remove worktree ${checkout}; run git worktree prune`)
      }
      rmSync(workdir, { recursive: true, force: true })
    }
  }
}

main()
