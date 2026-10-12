import type { CSSProperties } from 'react'
import { CardPennant } from '../../components/referenceEntity/card/CardPennant'
import { grainStyle } from '../../components/referenceEntity/card/cardGrain'
import { MissingArtMark } from '../../components/referenceEntity/card/MissingArt'
import { assetSrcSetFor } from '../../components/shared/assetSrcSet'
import { font, fontSize, space, tracking, weight } from '../../design/tokens'
import { useEntitySurface } from '../entitySurfaceContext'
import { LinkChevron, LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { Facts } from '../parts/Facts'
import { factCells } from '../parts/factCells'
import { paintFor } from '../parts/paint'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

export type TileProps = {
  model: EntityRowModel
  /** `link` on a listing; a tile has no `select` slot yet. */
  mode?: TileMode
  omit?: readonly EntityOmit[]
}

type TileMode = Extract<EntityMode, { kind: 'read' | 'link' }>

const READ: TileMode = { kind: 'read' }

/**
 * The 440 derivative is the tile's own rendition: a catalog column tops out
 * near 18rem, so 440 covers it at 1x–1.5x and 880 at 2x and up.
 */
const SIZES = '(min-width: 75rem) 18rem, 50vw'

/** The su-assets derivative at one allowlisted width (`assetSrcSet`). */
function derivative(url: string, width: 440 | 880): string {
  return url.replace(/\.webp$/, `-${width}.webp`)
}

/** The name on its cut-out of the paper below, in ink (ruleset, "Chapter band"). */
const NAME: CSSProperties = {
  color: 'var(--color-ink)',
  display: '-webkit-box',
  fontFamily: font.cond,
  fontSize: fontSize.title,
  fontWeight: weight.extrabold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.05,
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  textTransform: 'uppercase',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
}

/**
 * TILE — the catalog form: the artwork is the hero. The art at 3:4 on paper
 * (the line art multiplied onto it, or the entity's censor mark when its
 * schema has art and it has none), then the tone band with the name notched
 * into its foot on a cut-out of the paper below, in ink — the Workshop
 * Manual's chapter band at a tile's scale — then the facts as value cells.
 * Layout is `index.css`'s `.su-entity-tile*`.
 */
export function Tile({ model, mode = READ, omit = [] }: TileProps) {
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  const paint = paintFor(model.tone, { down: false, texture: surface.texture })
  const facts = factCells(model.facts, omit)
  const { art } = model

  return (
    <LinkSurface target={target} label={model.title} className="su-entity-tile">
      <div className="su-entity-tile__frame" data-user-made={model.userMade || undefined}>
        <span
          className={`su-entity-tile__art${art.kind === 'missing' ? ' su-entity-tile__art--missing' : ''}`}
        >
          {art.kind === 'image' ? (
            <img
              src={derivative(art.url, 440)}
              srcSet={assetSrcSetFor(art.url)}
              sizes={SIZES}
              width={440}
              height={587}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : art.kind === 'missing' ? (
            <MissingArtMark mark={art} />
          ) : null}
        </span>
        <div
          className="su-entity-tile__band"
          data-grain={paint.grain}
          style={{
            ...grainStyle(paint.grain),
            backgroundColor: paint.background,
            color: paint.color,
            columnGap: space[6],
          }}
        >
          <span className="su-entity-tile__notch">
            <span className="su-entity-tile__name" title={model.title} style={NAME}>
              {model.title}
            </span>
          </span>
          {model.cost && <CardPennant cost={model.cost} size="medium" subject={model.title} />}
          {(target.href || target.onOpen) && <LinkChevron />}
        </div>
        {facts.length > 0 && (
          <div className="su-entity-tile__cells">
            <Facts cells={facts} size="compact" />
          </div>
        )}
      </div>
    </LinkSurface>
  )
}
