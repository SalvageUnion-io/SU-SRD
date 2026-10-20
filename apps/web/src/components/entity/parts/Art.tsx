import type { EntityArt } from 'salvageunion-reference'
import { assetSrcSetFor } from '../../compositions/assetSrcSet'

/** A thumbnail: the 440 rendition covers it at any density. */
const SIZES = '5rem'

/**
 * ART (E10) — a Row's art: the entity's image on its own paper cut-out at the
 * head's left, notched into the band's foot as the name's tab is, the band
 * showing between the two (`Head`'s `art`). Shown by room, not by prop: the
 * cut-out appears only once the row is 18rem wide (`.su-entity-row__art`'s
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
