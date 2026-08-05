/**
 * sitemap — the replacement for `@astrojs/sitemap`.
 *
 * Emits the SAME two files Astro did, at the dist root:
 *
 *   sitemap-index.xml   one <sitemap> entry per urlset file
 *   sitemap-0.xml       the urlset itself
 *
 * Both are matched against the Astro baseline, so the shape here is copied from
 * it rather than invented: no newlines, no indentation, no `<lastmod>` /
 * `<changefreq>` / `<priority>` (none were configured), and the four extra
 * namespace declarations `sitemap.js` always writes on `<urlset>` even when
 * nothing uses them.
 *
 * ## Two independent exclusion mechanisms, on purpose
 *
 * 1. `RouteRegistration.sitemap` — the *authoritative* one. A page declares at
 *    its registration site whether it belongs in the sitemap (`ssg/routes.ts`),
 *    so the answer lives next to the page instead of being re-derived from the
 *    shape of its URL.
 * 2. `passesAstroSitemapFilter` — a verbatim port of the `filter` in
 *    `astro.config.mjs`. It is redundant with (1) for the pages we know about,
 *    and that is the point: it is the safety net that keeps a newly added
 *    `/og-card`-ish or `.og.png` URL out of the sitemap even if whoever adds it
 *    forgets the flag. Deleting it would silently widen the sitemap.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { SITE_URL } from '../src/lib/constants'
import { withTrailingSlash } from './render'

/**
 * `entryLimit` from `@astrojs/sitemap` (its default, never overridden in
 * `astro.config.mjs`). Well above the ~1,036 URLs this site emits, so exactly
 * one `sitemap-0.xml` is produced — but the index file exists precisely because
 * this can chunk, so the chunking is implemented rather than assumed away.
 */
const SITEMAP_ENTRY_LIMIT = 45_000

/**
 * The `filter` from `astro.config.mjs`, character for character. Astro handed
 * it the FULL page URL, so this takes the full URL too.
 *
 * - `/image`    — image routes are not pages
 * - `/greembeem`— standalone noindex pastiche document
 * - `.og.png`   — the generated per-entity social images
 * - `/og-card`  — the build-only screenshot surface
 */
function passesAstroSitemapFilter(page: string): boolean {
  return (
    !page.includes('/image') &&
    !page.includes('/greembeem') &&
    !page.includes('.og.png') &&
    !page.includes('/og-card')
  )
}

/**
 * Baseline ordering. `@astrojs/sitemap`'s output is exactly what a
 * numeric-aware `en` collator produces — verified against the baseline's 1,036
 * URLs, where a plain lexicographic sort disagrees on four of them
 * (`.../30mm-autocannon/` and `.../50-cal-machine-gun/` sort BEFORE
 * `.../120mm-cannon/`). Matching it costs nothing and makes the two files
 * byte-comparable.
 */
const collator = new Intl.Collator('en', { numeric: true })

/** `<`, `&` and friends are illegal raw in XML text. Slugs never contain them today; be correct anyway. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Route paths (no trailing slash, as `ErasedRoute.route` carries them) -> the
 * absolute, trailing-slashed, filtered, sorted URL list that goes in the urlset.
 */
function sitemapUrls(routes: readonly string[]): string[] {
  const urls = new Set<string>()
  for (const route of routes) {
    const url = new URL(withTrailingSlash(route), SITE_URL).href
    if (!passesAstroSitemapFilter(url)) continue
    urls.add(url)
  }
  return [...urls].sort((a, b) => collator.compare(a, b))
}

/** One `sitemap-N.xml` body. */
function renderUrlset(urls: readonly string[]): string {
  const entries = urls.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
    ' xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    entries,
    '</urlset>',
  ].join('')
}

/** The `sitemap-index.xml` body. */
function renderSitemapIndex(fileNames: readonly string[]): string {
  const entries = fileNames
    .map((name) => `<sitemap><loc>${escapeXml(new URL(`/${name}`, SITE_URL).href)}</loc></sitemap>`)
    .join('')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</sitemapindex>',
  ].join('')
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
    await writeFile(target, renderUrlset(chunk), 'utf-8')
  }

  const indexTarget = join(distDir, 'sitemap-index.xml')
  await mkdir(dirname(indexTarget), { recursive: true })
  await writeFile(indexTarget, renderSitemapIndex(fileNames), 'utf-8')

  return urls.length
}
