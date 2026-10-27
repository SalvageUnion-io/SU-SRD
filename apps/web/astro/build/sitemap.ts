/**
 * sitemap — Astro's own (`@astrojs/sitemap`): `sitemap-index.xml` over
 * `sitemap-0.xml`, the pages Astro built.
 *
 * The app's public pages (`/build/`) have their own urlset,
 * `/build/sitemap.xml` (`apps/web/src/worker/publicPages.ts`), and the index
 * lists it, so the one `robots.txt` line reaches both.
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

import sitemap from '@astrojs/sitemap'
import type { AstroIntegration } from 'astro'
import { appPath } from '../../src/lib/appBase'
import { SITE_URL } from '../../src/lib/constants'

/**
 * The pages kept out of the sitemap: the 404, the og card's screenshot
 * surface, and the app's shell, whose public pages have their own
 * (`build/sitemap.xml`). `passesSitemapFilter` is the net under this list.
 */
export const NOT_IN_SITEMAP: ReadonlySet<string> = new Set(['/404', '/og-card', '/build'])

/**
 * The URL filter. It takes the FULL page URL.
 *
 * - `/image`    — image routes are not pages
 * - `.og.png`   — the generated per-entity social images
 * - `/og-card`  — the build-only screenshot surface
 */
export function passesSitemapFilter(page: string): boolean {
  const route = `/${new URL(page).pathname.replace(/^\/+|\/+$/g, '')}`
  return (
    !NOT_IN_SITEMAP.has(route) &&
    !page.includes('/image') &&
    !page.includes('.og.png') &&
    !page.includes('/og-card')
  )
}

export function siteSitemap(): AstroIntegration {
  return sitemap({
    filter: passesSitemapFilter,
    customSitemaps: [`${SITE_URL}${appPath('/sitemap.xml')}`],
  })
}
