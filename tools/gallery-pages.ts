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
 * An artifact is data, not trust: its `gallery.json` must name the PR it was
 * filed under, or it is skipped.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { escapeHtml } from './lib/galleryHtml'

export type PullRequest = {
  number: number
  title: string
  head: { sha: string; repo: { full_name: string } | null }
  html_url: string
}

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

/** The site's front page: one row per published gallery, newest PR first. */
export function renderIndex(entries: readonly IndexEntry[], repo: string): string {
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
<p>Screenshots of every open pull request to main in ${escapeHtml(repo)}, rebuilt on each push.</p>
${entries.length ? `<ul>\n${rows}\n</ul>` : '<p>No open pull request has a gallery yet.</p>'}
</body>
</html>
`
}

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return (await res.json()) as T
}

type Artifact = { name: string; expired: boolean; archive_download_url: string }

async function main(): Promise<void> {
  const site = resolve(process.argv[2] ?? '')
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  if (!process.argv[2] || !token || !repo) {
    console.error(
      'usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo bun tools/gallery-pages.ts <site-dir>'
    )
    process.exit(2)
  }
  rmSync(site, { recursive: true, force: true })
  mkdirSync(site, { recursive: true })
  const prs = publishable(
    await api<PullRequest[]>(`/repos/${repo}/pulls?state=open&base=main&per_page=100`, token),
    repo
  )
  const entries: IndexEntry[] = []
  for (const pr of prs) {
    const { artifacts } = await api<{ artifacts: Artifact[] }>(
      `/repos/${repo}/actions/artifacts?name=pr-gallery-${pr.number}&per_page=5`,
      token
    )
    const artifact = artifacts.find((a) => !a.expired)
    if (!artifact) continue
    const zip = await fetch(artifact.archive_download_url, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!zip.ok) {
      console.warn(`[gallery-pages] #${pr.number}: download → ${zip.status}`)
      continue
    }
    const dir = join(site, String(pr.number))
    mkdirSync(dir, { recursive: true })
    const file = join(site, `${pr.number}.zip`)
    await Bun.write(file, await zip.arrayBuffer())
    const unzip = Bun.spawnSync(['unzip', '-q', '-o', file, '-d', dir])
    rmSync(file)
    if (unzip.exitCode !== 0) {
      console.warn(`[gallery-pages] #${pr.number}: unzip failed`)
      rmSync(dir, { recursive: true, force: true })
      continue
    }
    let meta: { pr?: unknown; sha?: unknown; capturedAt?: unknown }
    try {
      meta = JSON.parse(readFileSync(join(dir, 'gallery.json'), 'utf8'))
    } catch {
      // No readable gallery.json: the check below skips it as naming no PR.
      meta = {}
    }
    if (meta.pr !== pr.number) {
      console.warn(`[gallery-pages] #${pr.number}: gallery.json names another PR; skipped`)
      rmSync(dir, { recursive: true, force: true })
      continue
    }
    entries.push({
      number: pr.number,
      title: pr.title,
      sha: typeof meta.sha === 'string' ? meta.sha : pr.head.sha,
      capturedAt: typeof meta.capturedAt === 'string' ? meta.capturedAt : '',
      url: pr.html_url,
    })
  }
  writeFileSync(join(site, 'index.html'), renderIndex(entries, repo))
  writeFileSync(join(site, '.nojekyll'), '')
  console.log(`[gallery-pages] ${entries.length} of ${prs.length} open PRs published`)
}

if (import.meta.main) await main()
