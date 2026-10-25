/**
 * inlineScripts — the inline `<script>`s production would block.
 *
 * `public/_headers` gives `script-src` no hashes and no 'unsafe-inline', so an
 * inline script of any type but these is blocked in production: load it by
 * URL instead. JSON and JSON-LD are data blocks `script-src` never gates;
 * speculation rules are allowed by `'inline-speculation-rules'`. Astro
 * inlines a small enough hoisted script, so the build checks every page it
 * wrote (`./site`), not only what the page modules render.
 */

const INLINE_SCRIPT_TYPES = new Set(['application/json', 'application/ld+json', 'speculationrules'])

/** Every `<script>` opening tag with no `src` whose type the CSP would block. */
export function blockedInlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?=[\s/>])[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => !/\bsrc\s*=/i.test(tag))
    .filter((tag) => !INLINE_SCRIPT_TYPES.has(tag.match(/\btype="([^"]*)"/i)?.[1] ?? ''))
}
