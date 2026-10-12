import type { EntityArt, SURefMetaEntity } from 'salvageunion-reference'
import { missingArt } from 'salvageunion-reference'
import { tornEdge } from './missingArtMark'

/** The faded blueprint behind the mark: the 440 rendition for a thumbnail, the
 * 880 for the hero (`assetSrcSet`'s allowlisted widths). */
function Backdrop({ url, hero }: { url: string; hero: boolean }) {
  return (
    <img
      className="su-missing-art__backdrop"
      src={url.replace(/\.webp$/, hero ? '-880.webp' : '-440.webp')}
      alt=""
      loading="lazy"
      decoding="async"
    />
  )
}

/** The hero's faint list rows around the torn strip, as on the contents page. */
const GHOST_ROWS = ['12%', '25%', '66%', '79%']

/**
 * MISSING ART — what stands in the art place when an entity has no artwork,
 * quoting how the Workshop Manual censors its systems and modules (ruleset §1).
 * One of three marks, chosen per entity by the entity model (`missingArt`), so the listing's
 * thumbnail and the page's hero always wear the same one:
 *
 * - `file`: a torn ink patch, REDACTED and a code line carrying the page;
 * - `row`: a torn ink strip laid askew across the frame;
 * - `removed`: a red REMOVED rubber stamp.
 *
 * Behind each, faded into the paper, one of Rainmaker's chassis blueprints
 * (`backdrop`), as if the mark were laid over the archive's drawing.
 *
 * `hero` is the page's large form; without it, the compact card's thumbnail.
 * It is decoration (`aria-hidden`): the entity's name is the card's title.
 * Layout is `index.css`'s `.su-missing-art*`.
 */
export function MissingArt({ entity, hero = false }: { entity: SURefMetaEntity; hero?: boolean }) {
  return <MissingArtMark mark={missingArt(entity)} hero={hero} />
}

/** The censor mark the entity model chose (`EntityArt`'s `missing` arm). */
export function MissingArtMark({
  mark,
  hero = false,
}: {
  mark: Omit<Extract<EntityArt, { kind: 'missing' }>, 'kind'>
  hero?: boolean
}) {
  const { variant, code, short, seed, backdrop } = mark
  const className = `su-missing-art su-missing-art--${variant}${hero ? ' su-missing-art--hero' : ''}`

  if (variant === 'removed') {
    return (
      <span className={className} data-missing-art={variant} aria-hidden="true">
        <Backdrop url={backdrop} hero={hero} />
        <span className="su-missing-art__stamp">Removed</span>
      </span>
    )
  }

  if (variant === 'row') {
    return (
      <span className={className} data-missing-art={variant} aria-hidden="true">
        <Backdrop url={backdrop} hero={hero} />
        {hero &&
          GHOST_ROWS.map((top) => (
            <span key={top} className="su-missing-art__ghost" style={{ top }} />
          ))}
        <span className="su-missing-art__strip">
          <span
            className="su-missing-art__ink"
            style={{
              clipPath: tornEdge(seed, {
                depth: hero ? 16 : 22,
                steps: hero ? 40 : 16,
                sides: 'long',
              }),
            }}
          />
          <span className="su-missing-art__word">Redacted</span>
        </span>
      </span>
    )
  }

  return (
    <span className={className} data-missing-art={variant} aria-hidden="true">
      <Backdrop url={backdrop} hero={hero} />
      <span
        className="su-missing-art__ink su-missing-art__patch"
        style={{
          clipPath: tornEdge(seed, {
            depth: hero ? 3.5 : 7,
            steps: hero ? 44 : 18,
            sides: 'all',
          }),
        }}
      />
      <span className="su-missing-art__words">
        <span className="su-missing-art__word">Redacted</span>
        <span className="su-missing-art__code">{hero ? code : short}</span>
      </span>
    </span>
  )
}

/** The page's hero when the entity has no art: its censor mark, framed as art. */
export function MissingHero({ entity }: { entity: SURefMetaEntity }) {
  return (
    <figure className="su-entity-hero su-entity-hero--missing">
      <MissingArt entity={entity} hero />
    </figure>
  )
}
