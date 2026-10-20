import type { EntityArt } from 'salvageunion-reference'
import { assetSrcSetFor } from '../../compositions/assetSrcSet'

/** A thumbnail: the 440 rendition covers it at any density. */
const SIZES = '5rem'

/**
 * ART (E10) — a Row's art: the entity's image in its own paper window at the
 * head's left, the band on all four sides of it, centred on the row, apart
 * from the name's cut-out (`Head`'s `art`). Shown by room, not by prop: the
 * window appears only once the row is 18rem wide (`.su-entity-row__art`'s
 * container query). An entity without art has none.
 */
export function Art({ art }: { art: EntityArt }) {
  if (art.kind === 'none') return null
  return (
    <span className="su-entity-row__art">
      <img
        src={art.url}
        srcSet={assetSrcSetFor(art.url)}
        sizes={SIZES}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </span>
  )
}
