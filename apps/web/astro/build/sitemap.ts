/**
 * sitemap — `sitemap-index.xml` + `sitemap-0.xml`.
 *
 * Written at the end of the build (`astro/build/site.ts`) from the pages Astro
 * built. Emits two files at the dist root:
 *
 *   sitemap-index.xml   one <sitemap> entry per urlset file, then the app's
 *   sitemap-0.xml       the urlset itself
 *
 * The app's public pages (`/build/`) have their own urlset,
 * `/build/sitemap.xml` (`apps/web/src/worker/publicPages.ts`), and the index
 * lists it, so the one `robots.txt` line reaches both. Both urlsets and the
 * index are written by `src/lib/sitemapXml.ts`.
 *
 * ## Two independent exclusion mechanisms, on purpose
 *
 * 1. `NOT_IN_SITEMAP` — the *authoritative* one: the pages that must not be
 *    listed (the 404, the build-only og card), named.
 * 2. `passesSitemapFilter` — a URL filter. It is redundant with (1) for the
 *    pages we know about, and that is the point: it is the safety net that keeps a newly added
 *    `/og-card`-ish or `.og.png` URL out of the sitemap even if whoever adds it
 *    forgets the list. Deleting it would silently widen the sitemap.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { appPath } from '../../src/lib/appBase'
import { SITE_URL } from '../../src/lib/constants'
import { sitemapIndexXml, urlsetXml } from '../../src/lib/sitemapXml'
import { withTrailingSlash } from '../lib/routePath'

/**
 * The pages kept out of the sitemap: the 404, the og card's screenshot
 * surface, and the app's shell, whose public pages have their own
 * (`build/sitemap.xml`). `passesSitemapFilter` is the net under this list.
 */
export const NOT_IN_SITEMAP: ReadonlySet<string> = new Set(['/404', '/og-card', '/build'])

/**
 * URLs per urlset file (the sitemaps.org limit is 50,000). Well above the
 * thousand or so URLs this site emits, so exactly
 * one `sitemap-0.xml` is produced — but the index file exists precisely because
 * this can chunk, so the chunking is implemented rather than assumed away.
 */
const SITEMAP_ENTRY_LIMIT = 45_000

/**
 * The URL filter. It takes the FULL page URL.
 *
 * - `/image`    — image routes are not pages
 * - `.og.png`   — the generated per-entity social images
 * - `/og-card`  — the build-only screenshot surface
 */
function passesSitemapFilter(page: string): boolean {
  return !page.includes('/image') && !page.includes('.og.png') && !page.includes('/og-card')
}

/**
 * URL ordering: a numeric-aware `en` collator, so `.../30mm-autocannon/` and
 * `.../50-cal-machine-gun/` sort BEFORE `.../120mm-cannon/`, where a plain
 * lexicographic sort would disagree.
 */
const collator = new Intl.Collator('en', { numeric: true })

/**
 * Route paths (no trailing slash, as `ErasedRoute.route` carries them) -> the
 * absolute, trailing-slashed, filtered, sorted URL list that goes in the urlset.
 */
function sitemapUrls(routes: readonly string[]): string[] {
  const urls = new Set<string>()
  for (const route of routes) {
    const url = new URL(withTrailingSlash(route), SITE_URL).href
    if (!passesSitemapFilter(url)) continue
    urls.add(url)
  }
  return [...urls].sort((a, b) => collator.compare(a, b))
}

/** The app's urlset, served by its Worker. */
const APP_SITEMAP_URL = `${SITE_URL}${appPath('/sitemap.xml')}`

/** The `sitemap-index.xml` body. */
function renderSitemapIndex(fileNames: readonly string[]): string {
  return sitemapIndexXml([
    ...fileNames.map((name) => new URL(`/${name}`, SITE_URL).href),
    APP_SITEMAP_URL,
  ])
}

/** `sitemap-0.xml`, `sitemap-1.xml`, … one chunk per `SITEMAP_ENTRY_LIMIT` urls. */
function chunkUrls(urls: readonly string[]): string[][] {
  if (urls.length === 0) return [[]]
  const chunks: string[][] = []
  for (let i = 0; i < urls.length; i += SITEMAP_ENTRY_LIMIT) {
    chunks.push([...urls.slice(i, i + SITEMAP_ENTRY_LIMIT)])
  }
  return chunks
}

export type WriteSitemapOptions = {
  /** Sitemap-eligible route paths, WITHOUT a trailing slash (`/` stays `/`). */
  routes: readonly string[]
  /** Absolute path to the build output directory. */
  distDir: string
}

/**
 * Write `sitemap-index.xml` + `sitemap-N.xml` into `distDir`.
 *
 * @returns how many URLs made it into the urlset(s).
 */
export async function writeSitemap({ routes, distDir }: WriteSitemapOptions): Promise<number> {
  const urls = sitemapUrls(routes)
  const chunks = chunkUrls(urls)

  const fileNames: string[] = []
  for (const [index, chunk] of chunks.entries()) {
    const fileName = `sitemap-${index}.xml`
    fileNames.push(fileName)
    const target = join(distDir, fileName)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, urlsetXml(chunk), 'utf-8')
  }

  const indexTarget = join(distDir, 'sitemap-index.xml')
  await mkdir(dirname(indexTarget), { recursive: true })
  await writeFile(indexTarget, renderSitemapIndex(fileNames), 'utf-8')

  return urls.length
}
