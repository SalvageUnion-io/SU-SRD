/**
 * The app's public pages' urlset, `build/sitemap.xml` (`worker/publicPages.ts`),
 * in the shape `@astrojs/sitemap` gives the reference pages' (`sitemap-0.xml`):
 * no newlines, no indentation, no `<lastmod>` / `<changefreq>` / `<priority>`,
 * and four namespace declarations on `<urlset>` that nothing uses but crawlers
 * accept. Pure: the Worker bundles its callers.
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
