/**
 * The artwork derivative contract: which widths and which quality the artwork
 * CDN renders from a master, and the URL that names one.
 *
 * The CDN is the `su-lp-assets` R2 bucket on `assets.salvageunion.io`. Zone
 * URL-rewrite rules map `*-440q80.webp` and `*-880q80.webp` (and the older bare
 * `-440`/`-880` names) onto Image Transformations; nothing else renders, and a
 * WAF rule blocks a direct `/cdn-cgi/` request (ADR-033). The app builds
 * `srcset` candidates with {@link assetDerivativeUrl}. A width the app knew and
 * the rules did not would be a silent 404, which browsers resolve by quietly
 * falling back to the master.
 *
 * ## Why an allowlist
 *
 * Image Transformations bill by unique transformation, and the width arrives
 * in a public URL on an unauthenticated origin. An open range would let a
 * crawler walking `-1`, `-2`, `-3` exhaust the month's quota in one pass. So
 * the widths and the quality are each a closed set.
 *
 * ## Why these numbers
 *
 * `CardImage` sizes artwork into 220 CSS px, so 440 covers a 2x display and 880
 * a 4x one. The masters are print scans (up to 6098x7016), so serving one whole
 * into a 220px slot is a ~28x linear oversample.
 *
 * The quality is named in the URL (`mule-440q80.webp`) because the bare
 * `-440`/`-880` keys are spent: the first ones were baked into the bucket close
 * to lossless, and the edge and every browser hold them `immutable` for a year.
 * A new name is the only way past both.
 */

/** The rendered widths the artwork CDN serves. */
export const ASSET_RENDER_WIDTHS = [440, 880] as const

/** One of {@link ASSET_RENDER_WIDTHS}. */
export type AssetRenderWidth = (typeof ASSET_RENDER_WIDTHS)[number]

/** The WebP quality every derivative renders at, and the only one a URL may name. */
export const ASSET_RENDER_QUALITY = 80

/** The rendered derivative of a master at one of {@link ASSET_RENDER_WIDTHS}. */
export function assetDerivativeUrl(masterUrl: string, width: AssetRenderWidth): string {
  return masterUrl.replace(/\.webp$/, `-${width}q${ASSET_RENDER_QUALITY}.webp`)
}
