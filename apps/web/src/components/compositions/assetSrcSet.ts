/**
 * Width-constrained artwork candidates, derived from a master asset URL.
 *
 * The widths, the quality and the derivative URL are the artwork CDN's
 * contract, owned by `salvageunion-reference/assetDerivatives` and read by the
 * CDN (`apps/su-assets`) too, so the two cannot drift.
 */
import { ASSET_RENDER_WIDTHS, assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'

/**
 * An artwork `srcset` for a master URL, or undefined when there is no artwork.
 *
 * Pair with `sizes` (see `cardImageSizes`) — without it a browser assumes
 * `100vw` and picks the widest candidate, which is the behaviour this replaces.
 */
export function assetSrcSetFor(masterUrl: string | undefined): string | undefined {
  if (!masterUrl) return undefined
  // The master is deliberately NOT a candidate. A `w` descriptor for it would be
  // a guess — masters run from 1772px to 7196px wide and the entity carries no
  // dimensions — and omitting the descriptor is worse still, because a candidate
  // with none is treated as `1x` and competes with the `w` set. The master stays
  // on `src`, which is what a browser uses when no candidate fits and what a
  // `srcset`-blind client gets.
  return ASSET_RENDER_WIDTHS.map(
    (width) => `${assetDerivativeUrl(masterUrl, width)} ${width}w`
  ).join(', ')
}
