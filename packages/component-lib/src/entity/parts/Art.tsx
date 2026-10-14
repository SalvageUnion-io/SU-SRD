import type { EntityArt } from 'salvageunion-reference'
import { assetSrcSetFor } from '../../components/compositions/assetSrcSet'

/** A thumbnail: the 440 rendition covers it at any density. */
const SIZES = '5rem'

/**
 * ART (E10) — a Row's art column: the entity's image, the full height of the
 * row and ruled off in ink. Shown by room, not by prop: the column appears
 * only once the row is 18rem wide (`.su-entity-row__art`'s container query).
 * An entity without art has no column.
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
