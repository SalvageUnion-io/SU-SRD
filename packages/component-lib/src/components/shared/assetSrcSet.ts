/**
 * Width-constrained artwork candidates, derived from a master asset URL.
 *
 * ## Why this lives here and not in `salvageunion-reference`
 *
 * It used to be `getAssetSrcSet` in the dataset package, next to
 * `ASSET_DERIVATIVE_WIDTHS`. That put a decision about a *render slot* inside
 * the package that describes the *game data* — the old comment gave the game
 * away by explaining the widths in terms of "`CardImage`'s container", a
 * component the dataset has never heard of.
 *
 * The widths belong to whoever owns the slot, which is this package. The
 * dataset's job ends at `getAssetUrl`: it knows an entity has artwork and where
 * the master is, and nothing about how large anyone draws it.
 *
 * ## Why these two numbers
 *
 * `CardImage` sizes artwork into 220 CSS px, so 440 covers a 2x display and 880
 * a 4x one. The masters are print scans — measured across all 57, 30.9 MB total,
 * up to 1,295,746 B and 6098x7016 — so serving one whole into a 220px slot is a
 * ~28x linear oversample and made an illustrated entity page ~1.3 MB for a
 * thumbnail. That is the regression this exists to prevent.
 *
 * ## The contract with the origin
 *
 * `assets.salvageunion.io` renders these on demand through Cloudflare Images,
 * from the master, and **allowlists exactly these two widths** — an open range
 * on an unauthenticated public URL would let a crawler walking `-1`, `-2`, `-3`
 * exhaust the account's monthly transformation quota in a single pass.
 *
 * So this list and `ALLOWED_WIDTHS` in `apps/su-assets/src/worker.ts` must move
 * together. A width added here and not there is a 404, which browsers resolve by
 * quietly falling back rather than by telling anyone.
 */

/** The rendered widths `assets.salvageunion.io` will serve. Mirrors the origin's allowlist. */
export const ASSET_RENDER_WIDTHS = [440, 880] as const

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
    (width) => `${masterUrl.replace(/\.webp$/, `-${width}.webp`)} ${width}w`
  ).join(', ')
}
