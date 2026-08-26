/**
 * The rendered width of the entity-illustration slot, and the `sizes` that
 * describes it.
 *
 * ## Why this is its own module
 *
 * It lives beside `CardImage` rather than inside it because srd's item pages
 * need the `sizes` string for their `rel="preload"`, and exporting anything
 * from `CardImage.tsx` through the barrel makes `CardImage` itself a public
 * component — which `story-coverage.test.ts` then requires a co-located story
 * for. `CardImage` is deliberately internal; a pure string helper is not a
 * reason to change that.
 *
 * ## Why the preload needs the same string
 *
 * A `rel="preload"` for a responsive image participates in candidate selection.
 * If its `imagesizes` disagrees with the `<img>`'s `sizes`, it selects a
 * DIFFERENT candidate and the page downloads both files. That is not
 * hypothetical — measured on the built page, the `<img>` correctly took the
 * 30,588 B 440w derivative while a bare `href` preload pulled the 446,622 B
 * master alongside it. One definition, two consumers.
 */

/** The rendered width of the illustration slot, by density. */
export const CARD_IMAGE_CONTAINER_WIDTH = { normal: '220px', compact: '180px' } as const

/**
 * The `sizes` that belongs with `getAssetSrcSet`, for a given density.
 *
 * The container is a fixed width capped at `maxWidth: 100%`, so it is that
 * width except on a viewport narrower than the card itself.
 */
export function cardImageSizes(compact?: boolean): string {
  const width = compact ? CARD_IMAGE_CONTAINER_WIDTH.compact : CARD_IMAGE_CONTAINER_WIDTH.normal
  return `(max-width: ${width}) 100vw, ${width}`
}
