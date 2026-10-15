/**
 * The site's sitemap files as XML: the urlsets (`sitemap-0.xml`, the
 * reference pages', from `ssg/sitemap.ts`; `build/sitemap.xml`, the Cantina's
 * public pages', from `worker/publicPages.ts`) and the index that lists them.
 *
 * The shape is fixed: no newlines, no indentation, no `<lastmod>` /
 * `<changefreq>` / `<priority>`, and four namespace declarations on `<urlset>`
 * that nothing uses but crawlers accept. Pure: the Worker bundles its callers.
 */

import { escapeMarkup } from './documentHead'

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'

/** A urlset of absolute page URLs, in the order given. */
export function urlsetXml(urls: readonly string[]): string {
  const entries = urls.map((url) => `<url><loc>${escapeMarkup(url)}</loc></url>`).join('')
  return [
    XML_DECLARATION,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
    ' xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    entries,
    '</urlset>',
  ].join('')
}

/** A sitemap index of absolute urlset URLs, in the order given. */
export function sitemapIndexXml(locs: readonly string[]): string {
  const entries = locs.map((loc) => `<sitemap><loc>${escapeMarkup(loc)}</loc></sitemap>`).join('')
  return [
    XML_DECLARATION,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</sitemapindex>',
  ].join('')
}
