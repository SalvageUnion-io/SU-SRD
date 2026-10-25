/**
 * builtAssets — how a page addresses a file that Vite emitted.
 *
 * Page modules stay free of build imports, so a page does not `import` an
 * asset for its hashed URL. Instead `astro/lib/assets.ts` imports it with
 * `?url`, so Vite emits it, and the page looks the URL up here from
 * `RouteContext.builtAssets`.
 *
 * The keys below are source paths: an asset's path relative to the Vite root,
 * which for this app is `apps/web`.
 */

import type { BuiltAssets } from '../reference/types'

/** The Eldridge Coast map, shown in `/about`'s lightbox. */
export const ELDRIDGE_COAST_MAP = 'src/assets/eldridge-coast-map.webp'

/**
 * The emitted URL for one source asset — e.g. `/assets/eldridge-coast-map-Bx1.webp`.
 *
 * Throws rather than returning an empty `src`: the only way to miss is to drop
 * the asset's import from `astro/lib/assets.ts`, and a silently broken
 * `<img>` in a static build is a regression no page-text check sees. Failing
 * loudly at build time is the signal, which is why this throws.
 */
export function builtAssetUrl(assets: BuiltAssets, source: string): string {
  const url = assets[source]
  if (url === undefined) {
    const known = Object.keys(assets).sort().join(', ') || '<none>'
    throw new Error(
      `No built asset for "${source}". Is it imported by astro/lib/assets.ts? Known: ${known}`
    )
  }
  return url
}
