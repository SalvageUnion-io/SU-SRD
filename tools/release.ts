#!/usr/bin/env bun
/**
 * Tag and publish a release on merge — `bun tools/release.ts --sha <commit>`.
 *
 * Run by `.github/workflows/release.yml` when a push to `main` changes the root
 * `package.json` (a push to `design-refresh` dry-runs it). The version is
 * the root `package.json` `version`; when no tag `v<version>` exists yet, it
 * publishes a GitHub release of that name on the pushed commit (which creates
 * the tag), with the merged PR's **What changed** section as its notes, word
 * for word: no generated notes, and no `Closes #N` lines. A merge that did not
 * bump the version finds its tag already there and does nothing, so only the
 * PR that bumps the version releases.
 *
 * ## Why it exists
 *
 * 3.0.0's tag and release were a by-hand step on the release PR's post-merge
 * checklist, and cloud sessions get 403 on the releases API, so only the owner
 * could run it. The owner chose (2026-10-14) that the release notes are the
 * release PR's What changed section, unedited: one changelog across the PR, the
 * release and the blog post.
 *
 * A version of `0.0.0` (none set) skips. A bumped version whose merge has no PR,
 * or whose PR has no What changed section, fails: a release with empty notes
 * is worse than a red run the owner can re-run after fixing the PR body.
 *
 * Usage:
 *   bun tools/release.ts --sha <commit> [--dry-run]
 *   (GITHUB_REPOSITORY and GITHUB_TOKEN from the environment)
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Pull = {
  number: number
  body: string | null
  merged_at: string | null
  merge_commit_sha: string | null
}

export type ReleaseDeps = {
  /** The root `package.json` `version`. */
  version: () => string
  /** A GitHub REST call: the parsed JSON, or `null` on 404. Throws on any other failure. */
  api: (method: 'GET' | 'POST', path: string, body?: unknown) => Promise<unknown>
  repo: string
  log: (line: string) => void
  error: (line: string) => void
}

/**
 * The PR body's `## What changed` section, without its heading, up to the next
 * `## ` heading. `Closes #N` lines are dropped.
 */
export function whatChanged(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((l) => /^## What changed\s*$/.test(l))
  if (start === -1) return ''
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^## /.test(l))
  return (end === -1 ? rest : rest.slice(0, end))
    .filter((l) => !/^\s*(also )?closes #\d+/i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function main(argv: string[], deps: ReleaseDeps): Promise<number> {
  const { api, repo, log, error } = deps
  const shaAt = argv.indexOf('--sha')
  const sha = shaAt === -1 ? undefined : argv[shaAt + 1]
  if (!sha) {
    error('release: --sha <commit> is required.')
    return 1
  }
  const dryRun = argv.includes('--dry-run')

  const version = deps.version()
  if (version === '0.0.0') {
    log('release: root package.json has no version (0.0.0); nothing to release.')
    return 0
  }
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    error(`release: root package.json version "${version}" is not semver.`)
    return 1
  }
  const tag = `v${version}`

  if ((await api('GET', `/repos/${repo}/git/ref/tags/${tag}`)) !== null) {
    log(`release: ${tag} already exists; this merge did not bump the version. Nothing to do.`)
    return 0
  }

  const pulls = ((await api('GET', `/repos/${repo}/commits/${sha}/pulls`)) ?? []) as Pull[]
  const pr = pulls.find((p) => p.merged_at !== null && p.merge_commit_sha === sha)
  if (!pr) {
    error(`release: ${tag} is new, but no merged PR has ${sha} as its merge commit.`)
    return 1
  }
  const notes = whatChanged(pr.body ?? '')
  if (notes === '') {
    error(`release: #${pr.number} has no "## What changed" section to use as ${tag}'s notes.`)
    return 1
  }

  if (dryRun) {
    log(`release: would publish ${tag} on ${sha} from #${pr.number}:\n\n${notes}`)
    return 0
  }
  const release = (await api('POST', `/repos/${repo}/releases`, {
    tag_name: tag,
    target_commitish: sha,
    name: tag,
    body: notes,
    make_latest: 'true',
  })) as { html_url: string }
  log(`release: published ${tag} from #${pr.number}: ${release.html_url}`)
  return 0
}

/** The REST client `main` gets in Actions: `null` on 404, throws on any other failure. */
export function githubApi(token: string, fetchFn: typeof fetch = fetch): ReleaseDeps['api'] {
  return async (method, path, body) => {
    const res = await fetchFn(`https://api.github.com${path}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
    return res.json()
  }
}

/** The live dependencies: the repo's root `package.json` and the Actions environment. */
export function liveDeps(
  root: string,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch = fetch
): ReleaseDeps {
  return {
    version: () => JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version,
    api: githubApi(env.GITHUB_TOKEN ?? '', fetchFn),
    repo: env.GITHUB_REPOSITORY ?? 'SalvageUnion-io/SU-SRD',
    log: console.log,
    error: console.error,
  }
}

if (import.meta.main) {
  process.exit(
    await main(process.argv.slice(2), liveDeps(join(import.meta.dir, '..'), process.env))
  )
}
