import type { EntityArt } from 'salvageunion-reference'
import { assetSrcSetFor } from '../../components/compositions/assetSrcSet'
import { MissingArtMark } from '../../components/referenceEntity/card/MissingArt'

/** A thumbnail: the 440 rendition covers it at any density. */
const SIZES = '5rem'

/**
 * ART (E10) — a Row's art column: the entity's image, or its censor mark when
 * the schema has art and the entity has none, the full height of the row and
 * ruled off in ink. Shown by room, not by prop: the column appears only once
 * the row is 18rem wide (`.su-entity-row__art`'s container query). A schema
 * with no art has no column.
 */
export function Art({ art }: { art: EntityArt }) {
  if (art.kind === 'none') return null
  return (
    <span
      className={`su-entity-row__art${art.kind === 'missing' ? ' su-entity-row__art--missing' : ''}`}
    >
      {art.kind === 'image' ? (
        <img
          src={art.url}
          srcSet={assetSrcSetFor(art.url)}
          sizes={SIZES}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <MissingArtMark mark={art} />
      )}
    </span>
  )
}
