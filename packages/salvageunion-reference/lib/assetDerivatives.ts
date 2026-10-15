/**
 * The artwork derivative contract: which widths and which quality the artwork
 * CDN (`apps/su-assets`) renders from a master, and the URL that names one.
 *
 * Both sides read it here: the app builds `srcset` candidates with
 * {@link assetDerivativeUrl}, and the CDN accepts exactly what
 * {@link parseAssetDerivative} reads back and these constants allow. A width
 * one side knew and the other did not would be a silent 404, which browsers
 * resolve by quietly falling back to the master.
 *
 * ## Why an allowlist
 *
 * The CDN renders through Cloudflare Images, which bills by unique
 * transformation, and the width arrives in a public URL on an unauthenticated
 * origin. An open range would let a crawler walking `-1`, `-2`, `-3` exhaust
 * the month's quota in one pass. So the widths and the quality are each a
 * closed set.
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

/**
 * An object key read as a derivative:
 * `chassis/mule-440q80.webp` -> `{ masterKey: 'chassis/mule.webp', width: 440, quality: 80 }`,
 * and the older `chassis/mule-440.webp` the same with no quality named. Null
 * when the key names no width. Whether the width and quality are allowed is
 * {@link isServedDerivative}.
 */
export function parseAssetDerivative(
  key: string
): { masterKey: string; width: number; quality: number | undefined } | null {
  const match = /^(.*)-(\d+)(?:q(\d+))?(\.[a-z0-9]+)$/i.exec(key)
  if (!match) return null
  const [, stem, digits, quality, ext] = match
  if (stem === undefined || digits === undefined || ext === undefined) return null
  return {
    masterKey: `${stem}${ext}`,
    width: Number(digits),
    quality: quality === undefined ? undefined : Number(quality),
  }
}

/** Whether the CDN renders this derivative: an allowed width, at the one quality or none named. */
export function isServedDerivative(derivative: {
  width: number
  quality: number | undefined
}): boolean {
  return (
    ASSET_RENDER_WIDTHS.some((width) => width === derivative.width) &&
    (derivative.quality === undefined || derivative.quality === ASSET_RENDER_QUALITY)
  )
}
