/**
 * sitemap — the replacement for `@astrojs/sitemap`.
 *
 * Three things here are copied from the Astro baseline rather than chosen, and
 * each is a silent regression if it drifts:
 *
 *   - the URL set: trailing-slashed absolute URLs, minus Astro's four-clause
 *     `filter` from `astro.config.mjs`;
 *   - the ORDER: `Intl.Collator('en', {numeric:true})`, which disagrees with a
 *     plain lexicographic sort on four of the baseline's 1,036 URLs;
 *   - the XML shape: one line, no indentation, and the four unused namespace
 *     declarations `sitemap.js` always writes.
 *
 * Everything is asserted through `writeSitemap` — the module's only export —
 * because that is the whole surface `ssg/build.ts` uses.
 */

import { describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SITE_URL } from '../../src/lib/constants'
import { writeSitemap } from '../sitemap'

type Emitted = { count: number; index: string; urlsets: Record<string, string> }

/** Run `writeSitemap` into a throwaway directory and read back what it wrote. */
async function emit(routes: readonly string[], chunkNames: readonly string[] = ['sitemap-0.xml']) {
  const distDir = await mkdtemp(join(tmpdir(), 'srd-sitemap-'))
  try {
    const count = await writeSitemap({ routes, distDir })
    const urlsets: Record<string, string> = {}
    for (const name of chunkNames) {
      urlsets[name] = await readFile(join(distDir, name), 'utf-8')
    }
    const index = await readFile(join(distDir, 'sitemap-index.xml'), 'utf-8')
    return { count, index, urlsets } satisfies Emitted
  } finally {
    await rm(distDir, { recursive: true, force: true })
  }
}

/** The `<loc>` values of a urlset, in document order. */
function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '')
}

describe('URL selection', () => {
  it('emits absolute, trailing-slashed URLs against the site origin', async () => {
    const { count, urlsets } = await emit(['/', '/about', '/schema/chassis'])

    expect(locs(urlsets['sitemap-0.xml'] ?? '')).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/about/`,
      `${SITE_URL}/schema/chassis/`,
    ])
    expect(count).toBe(3)
  })

  it("applies Astro's filter — /image, /greembeem, .og.png and /og-card never appear", async () => {
    // A verbatim port of the `filter` in astro.config.mjs. It is the safety net
    // for a page whose registration forgets `sitemap: false`, so it has to bite
    // on the URL alone.
    const { count, urlsets } = await emit([
      '/about',
      '/greembeem',
      '/og-card',
      '/schema/chassis/item/aegis',
      '/schema/chassis/item/aegis.og.png',
      '/api/image',
      '/schema/image-noise',
    ])

    expect(locs(urlsets['sitemap-0.xml'] ?? '')).toEqual([
      `${SITE_URL}/about/`,
      `${SITE_URL}/schema/chassis/item/aegis/`,
    ])
    expect(count).toBe(2)
  })

  it('deduplicates routes that normalize to the same URL', async () => {
    const { count, urlsets } = await emit(['/about', '/about/'])

    expect(locs(urlsets['sitemap-0.xml'] ?? '')).toEqual([`${SITE_URL}/about/`])
    expect(count).toBe(1)
  })

  it('still emits both files when every route is filtered out', async () => {
    // An empty `sitemap-0.xml` is what Astro produced, and the index must keep
    // pointing at it — an absent file would 404 for every crawler that follows
    // the index.
    const { count, index, urlsets } = await emit(['/og-card'])

    expect(count).toBe(0)
    expect(locs(urlsets['sitemap-0.xml'] ?? '')).toEqual([])
    expect(urlsets['sitemap-0.xml']).toContain('<urlset')
    expect(locs(index)).toEqual([`${SITE_URL}/sitemap-0.xml`])
  })
})

describe('ordering', () => {
  it('sorts numerically, the way the baseline does — not lexicographically', async () => {
    // The four URLs that made the collator load-bearing: a plain string sort
    // puts `/30mm-…` and `/50-cal-…` BEFORE `/120mm-…` because '1' < '3' < '5'
    // character-wise. `Intl.Collator('en', {numeric: true})` compares the runs
    // of digits as numbers, so 120 sorts after 50.
    const routes = [
      '/schema/systems/item/50-cal-machine-gun',
      '/schema/systems/item/120mm-cannon',
      '/schema/systems/item/30mm-autocannon',
    ]

    const { urlsets } = await emit(routes)
    const emitted = locs(urlsets['sitemap-0.xml'] ?? '')

    expect(emitted).toEqual([
      `${SITE_URL}/schema/systems/item/30mm-autocannon/`,
      `${SITE_URL}/schema/systems/item/50-cal-machine-gun/`,
      `${SITE_URL}/schema/systems/item/120mm-cannon/`,
    ])

    // …and the lexicographic answer is genuinely different, so this test is
    // pinning a real choice rather than restating the default.
    const lexicographic = [...emitted].sort()
    expect(lexicographic).not.toEqual(emitted)
  })

  it('is independent of the order routes were registered in', async () => {
    const forwards = await emit(['/a', '/b', '/c'])
    const backwards = await emit(['/c', '/b', '/a'])

    expect(locs(backwards.urlsets['sitemap-0.xml'] ?? '')).toEqual(
      locs(forwards.urlsets['sitemap-0.xml'] ?? '')
    )
  })
})

describe('XML shape', () => {
  it('reproduces the urlset preamble byte for byte, unused namespaces included', async () => {
    // `sitemap.js` always writes news/xhtml/image/video, and nothing here uses
    // them. They stay because the two files are compared to the baseline.
    const { urlsets } = await emit(['/about'])

    expect(urlsets['sitemap-0.xml']).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
        ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"' +
        ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' +
        ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' +
        ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">' +
        `<url><loc>${SITE_URL}/about/</loc></url>` +
        '</urlset>'
    )
  })

  it('writes sitemap-index.xml pointing at every urlset chunk', async () => {
    const { index } = await emit(['/about'])

    expect(index).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        `<sitemap><loc>${SITE_URL}/sitemap-0.xml</loc></sitemap>` +
        '</sitemapindex>'
    )
  })

  it('emits no newlines or indentation', async () => {
    const { index, urlsets } = await emit(['/about', '/api'])

    expect(urlsets['sitemap-0.xml']).not.toContain('\n')
    expect(index).not.toContain('\n')
  })

  it('escapes XML metacharacters in a slug', async () => {
    // No slug contains one today. The escaping exists so that the day one does,
    // the site emits a valid sitemap instead of one Google refuses to parse.
    const { urlsets } = await emit(['/schema/x/item/a&b'])

    expect(urlsets['sitemap-0.xml']).toContain(`<loc>${SITE_URL}/schema/x/item/a&amp;b/</loc>`)
    expect(urlsets['sitemap-0.xml']).not.toContain('item/a&b')
  })
})
