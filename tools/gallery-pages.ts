#!/usr/bin/env bun
/**
 * gallery-pages — assembles the PR galleries' GitHub Pages site.
 *
 *   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo bun tools/gallery-pages.ts <site-dir>
 *
 * `pr-gallery-pages.yml` runs it after every `PR gallery` run. Pages serves one
 * site at a time, so each deploy rebuilds the whole of it: for every OPEN pull
 * request to main from a branch of this repository, the newest `pr-gallery-<n>`
 * artifact (`tools/gallery.ts`'s output, uploaded by `pr-gallery.yml`) is
 * unpacked to `<site-dir>/<n>/`, and `<site-dir>/index.html` lists them. A
 * closed PR's gallery drops out at the next deploy; a fork's never goes in,
 * because its artifact is HTML its author wrote, served from this
 * repository's Pages origin.
 *
 * The Preview Tour — the same gallery shot from main, dispatched by hand with
 * no PR number — is unpacked to
 * `<site-dir>/tour/` from the newest `preview-tour` artifact a main run of
 * this repository uploaded, and the index links it first.
 *
 * An artifact is data, not trust: its `gallery.json` must name the PR it was
 * filed under (a tour's names none), or it is skipped.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { escapeHtml } from 'gates/lib/galleryHtml'

export type PullRequest = {
  number: number
  title: string
  head: { sha: string; repo: { full_name: string } | null }
  html_url: string
}

/** The Preview Tour's line in the index. */
export type TourEntry = { sha: string; capturedAt: string }

export type IndexEntry = {
  number: number
  title: string
  sha: string
  capturedAt: string
  url: string
}

/** The open PRs whose galleries may be published: same-repository heads only. */
export function publishable(prs: readonly PullRequest[], repo: string): PullRequest[] {
  return prs.filter((pr) => pr.head.repo?.full_name === repo)
}

/** The site's front page: the Preview Tour when there is one, then one row per published gallery, newest PR first. */
export function renderIndex(
  entries: readonly IndexEntry[],
  repo: string,
  tour?: TourEntry
): string {
  const rows = [...entries]
    .sort((a, b) => b.number - a.number)
    .map(
      (e) => `<li><a href="./${e.number}/"><strong>#${e.number}</strong> ${escapeHtml(e.title)}</a>
      <span>${escapeHtml(e.sha.slice(0, 7))} · ${escapeHtml(e.capturedAt)} · <a href="${escapeHtml(e.url)}">PR</a></span></li>`
    )
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>PR galleries</title>
<style>
:root { --paper: #fbfaf7; --ground: #efebe4; --ink: #282019; --ink-2: #5b5044; }
@media (prefers-color-scheme: dark) { :root { --paper: #241d17; --ground: #1b1712; --ink: #f1ece3; --ink-2: #c4b9aa; color-scheme: dark; } }
body { background: var(--ground); color: var(--ink); font-family: system-ui, sans-serif; margin: 0 auto; max-width: 48rem; padding: 2rem 16px; }
h1 { font-size: 1.75rem; text-transform: uppercase; margin: 0 0 1rem; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
li { background: var(--paper); border: 1.5px solid var(--ink); border-radius: 3px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.2rem; }
li > a { color: var(--ink); text-decoration: none; }
span { color: var(--ink-2); font-size: 0.875rem; }
span a { color: var(--ink-2); }
</style>
</head>
<body>
<h1>PR galleries</h1>
${
  tour
    ? `<ul><li><a href="./tour/"><strong>Preview tour</strong> main, as last deployed</a>
      <span>${escapeHtml(tour.sha.slice(0, 7))} · ${escapeHtml(tour.capturedAt)}</span></li></ul>
`
    : ''
}<p>Screenshots of every open pull request to main in ${escapeHtml(repo)}, rebuilt on each push.</p>
${entries.length ? `<ul>\n${rows}\n</ul>` : '<p>No open pull request has a gallery yet.</p>'}
</body>
</html>
`
}

/**
 * The index entry for a gallery unpacked to `dir`, or undefined when its
 * `gallery.json` is missing, unreadable or names another PR.
 */
export function readGalleryMeta(dir: string, pr: PullRequest): IndexEntry | undefined {
  let meta: { pr?: unknown; sha?: unknown; capturedAt?: unknown }
  try {
    meta = JSON.parse(readFileSync(join(dir, 'gallery.json'), 'utf8'))
  } catch {
    // No readable gallery.json: the check below skips it as naming no PR.
    meta = {}
  }
  if (meta?.pr !== pr.number) return undefined
  return {
    number: pr.number,
    title: pr.title,
    sha: typeof meta.sha === 'string' ? meta.sha : pr.head.sha,
    capturedAt: typeof meta.capturedAt === 'string' ? meta.capturedAt : '',
    url: pr.html_url,
  }
}

/**
 * The index entry for the Preview Tour unpacked to `dir`, or undefined when its
 * `gallery.json` is missing, unreadable or names a PR (a PR's gallery, not the tour).
 */
export function readTourMeta(dir: string): TourEntry | undefined {
  let meta: { pr?: unknown; sha?: unknown; capturedAt?: unknown }
  try {
    meta = JSON.parse(readFileSync(join(dir, 'gallery.json'), 'utf8'))
  } catch {
    return undefined
  }
  if (meta?.pr !== null || typeof meta.sha !== 'string') return undefined
  return { sha: meta.sha, capturedAt: typeof meta.capturedAt === 'string' ? meta.capturedAt : '' }
}

/** Where the site's galleries come from: GitHub in `main`, a stand-in in the tests. */
export type GallerySource = {
  /** The open PRs to main. */
  openPrs(): Promise<PullRequest[]>
  /** Unpacks a PR's newest gallery artifact into `dir`; false (with the reason logged) when there is none to unpack. */
  unpack(pr: PullRequest, dir: string): Promise<boolean>
  /** Unpacks the newest Preview Tour main uploaded into `dir`; false (with the reason logged) when there is none. */
  unpackTour(dir: string): Promise<boolean>
}

/** Rebuilds the whole site in `site`: the Preview Tour under `tour/`, each publishable PR's gallery under `<n>/`, then the index. */
export async function buildSite(
  site: string,
  repo: string,
  source: GallerySource
): Promise<{ published: IndexEntry[]; open: number; tour?: TourEntry }> {
  rmSync(site, { recursive: true, force: true })
  mkdirSync(site, { recursive: true })
  const prs = publishable(await source.openPrs(), repo)
  const published: IndexEntry[] = []
  for (const pr of prs) {
    const dir = join(site, String(pr.number))
    mkdirSync(dir, { recursive: true })
    const unpacked = await source.unpack(pr, dir)
    const entry = unpacked ? readGalleryMeta(dir, pr) : undefined
    if (!entry) {
      if (unpacked)
        console.warn(`[gallery-pages] #${pr.number}: gallery.json names another PR; skipped`)
      rmSync(dir, { recursive: true, force: true })
      continue
    }
    published.push(entry)
  }
  const tourDir = join(site, 'tour')
  mkdirSync(tourDir, { recursive: true })
  const tourUnpacked = await source.unpackTour(tourDir)
  const tour = tourUnpacked ? readTourMeta(tourDir) : undefined
  if (!tour) {
    if (tourUnpacked) console.warn('[gallery-pages] tour: gallery.json is not a tour; skipped')
    rmSync(tourDir, { recursive: true, force: true })
  }
  writeFileSync(join(site, 'index.html'), renderIndex(published, repo, tour))
  writeFileSync(join(site, '.nojekyll'), '')
  return { published, open: prs.length, ...(tour ? { tour } : {}) }
}

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return (await res.json()) as T
}

type Artifact = {
  name: string
  expired: boolean
  archive_download_url: string
  workflow_run?: { head_branch?: string; repository_id?: number; head_repository_id?: number }
}

/** Downloads `artifact` and unzips it into `dir`; false (with the reason logged under `label`) when either fails. */
async function unpackArtifact(
  artifact: Artifact,
  dir: string,
  token: string,
  label: string
): Promise<boolean> {
  const zip = await fetch(artifact.archive_download_url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!zip.ok) {
    console.warn(`[gallery-pages] ${label}: download → ${zip.status}`)
    return false
  }
  const file = `${dir}.zip`
  await Bun.write(file, await zip.arrayBuffer())
  const unzip = Bun.spawnSync(['unzip', '-q', '-o', file, '-d', dir])
  rmSync(file)
  if (unzip.exitCode !== 0) {
    console.warn(`[gallery-pages] ${label}: unzip failed`)
    return false
  }
  return true
}

/**
 * Whether a `preview-tour` artifact came from a main run of this repository.
 * A PR can edit its own copy of `pr-gallery.yml` to upload one under that name,
 * so the name alone proves nothing; its run's head branch and repository do.
 */
export function isMainTour(artifact: Artifact): boolean {
  const run = artifact.workflow_run
  return (
    !artifact.expired &&
    run?.head_branch === 'main' &&
    run.repository_id !== undefined &&
    run.head_repository_id === run.repository_id
  )
}

/** The galleries as GitHub holds them: each PR's newest unexpired `pr-gallery-<n>` artifact, and main's newest `preview-tour`. */
export function githubSource(repo: string, token: string): GallerySource {
  return {
    openPrs: () =>
      api<PullRequest[]>(`/repos/${repo}/pulls?state=open&base=main&per_page=100`, token),
    async unpack(pr, dir) {
      const { artifacts } = await api<{ artifacts: Artifact[] }>(
        `/repos/${repo}/actions/artifacts?name=pr-gallery-${pr.number}&per_page=5`,
        token
      )
      const artifact = artifacts.find((a) => !a.expired)
      if (!artifact) return false
      return unpackArtifact(artifact, dir, token, `#${pr.number}`)
    },
    async unpackTour(dir) {
      const { artifacts } = await api<{ artifacts: Artifact[] }>(
        `/repos/${repo}/actions/artifacts?name=preview-tour&per_page=20`,
        token
      )
      const artifact = artifacts.find(isMainTour)
      if (!artifact) {
        console.warn('[gallery-pages] tour: no unexpired preview-tour from main')
        return false
      }
      return unpackArtifact(artifact, dir, token, 'tour')
    },
  }
}

/** The CLI: builds the site in `argv[0]` from `env`'s token and repository; returns the exit code. */
export async function main(
  argv: readonly string[],
  env: Record<string, string | undefined>
): Promise<number> {
  const [dir] = argv
  const token = env.GITHUB_TOKEN
  const repo = env.GITHUB_REPOSITORY
  if (!dir || !token || !repo) {
    console.error(
      'usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo bun tools/gallery-pages.ts <site-dir>'
    )
    return 2
  }
  const { published, open, tour } = await buildSite(resolve(dir), repo, githubSource(repo, token))
  console.log(`[gallery-pages] ${published.length} of ${open} open PRs published`)
  console.log(`[gallery-pages] preview tour: ${tour ? tour.sha.slice(0, 7) : 'none'}`)
  return 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2), process.env))
