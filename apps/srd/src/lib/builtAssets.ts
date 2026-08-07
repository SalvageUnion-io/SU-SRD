/**
 * builtAssets — how a page addresses a file that Vite emitted.
 *
 * The SSR pass runs under Bun, so a page cannot `import` an asset and get its
 * hashed URL (Bun would hand back a filesystem path). Instead
 * `src/runtime/assets.entry.ts` imports the asset so Vite emits it, `ssg/build.ts`
 * reads the resulting `dist/.vite/manifest.json` entries, and the page looks the
 * URL up here from `RouteContext.builtAssets`.
 *
 * The keys below are manifest keys: an asset's path relative to the Vite root,
 * which for this app is `apps/srd`.
 */

import type { BuiltAssets } from '../../ssg/types'

/** The Eldridge Coast map, shown in `/about`'s lightbox. */
export const ELDRIDGE_COAST_MAP = 'src/assets/eldridge-coast-map.webp'

/**
 * The emitted URL for one source asset — e.g. `/assets/eldridge-coast-map-Bx1.webp`.
 *
 * Throws rather than returning an empty `src`: the only way to miss is to drop
 * the asset's import from `src/runtime/assets.entry.ts`, and a silently broken
 * `<img>` in a static build is a regression no automated check here catches —
 * not the retired parity gate, which never compared image bytes, and not the
 * unit suite. Failing loudly at build time is the only signal available.
 */
export function builtAssetUrl(assets: BuiltAssets, source: string): string {
  const url = assets[source]
  if (url === undefined) {
    const known = Object.keys(assets).sort().join(', ') || '<none>'
    throw new Error(
      `No built asset for "${source}". Is it imported by src/runtime/assets.entry.ts? Known: ${known}`
    )
  }
  return url
}
