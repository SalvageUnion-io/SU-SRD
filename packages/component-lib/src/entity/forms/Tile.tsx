import type { CSSProperties } from 'react'
import { assetSrcSetFor } from '../../components/compositions/assetSrcSet'
import { grainClass } from '../../components/referenceEntity/card/cardGrain'
import { font, fontSize, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { useEntitySurface } from '../entitySurfaceContext'
import { LinkChevron, LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { CostBox } from '../parts/Chips'
import { Facts } from '../parts/Facts'
import { factCells } from '../parts/factCells'
import { Lead } from '../parts/Lead'
import { paintFor } from '../parts/paint'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

export type TileProps = {
  model: EntityRowModel
  /** `link` on a listing; a tile has no `select` slot yet. */
  mode?: TileMode
  omit?: readonly EntityOmit[]
  /** The opening prose under the cells, while browsing (E11). */
  lead?: boolean
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
 * (the line art multiplied onto it); an entity without art has no art place,
 * so its tile opens on the band. Then the tone band with the name notched
 * into its foot on a cut-out of the paper below, in ink — the Workshop
 * Manual's chapter band at a tile's scale — then the cost and the facts as
 * chips (`EP | 2`, `SLOTS | 1`) and, while browsing, the lead clamped to three
 * lines.
 * Layout is `index.css`'s `.su-entity-tile*`.
 */
export function Tile({ model, mode = READ, omit = [], lead = false }: TileProps) {
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  const paint = paintFor(model.tone, { down: false, texture: surface.texture })
  const facts = factCells(model.facts, omit)
  const { art } = model
  const leadText = lead ? model.lead : undefined

  return (
    <LinkSurface
      target={target}
      label={model.title}
      className={art.kind === 'image' ? 'su-entity-tile' : 'su-entity-tile su-entity-tile--bare'}
    >
      <div className="su-entity-tile__frame" data-user-made={model.userMade || undefined}>
        {art.kind === 'image' && (
          <span className="su-entity-tile__art">
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
          </span>
        )}
        <div
          className={cn('su-entity-tile__band', grainClass(paint.grain))}
          data-grain={paint.grain}
          style={{
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
          {(target.href || target.onOpen) && <LinkChevron />}
        </div>
        {(model.cost || facts.length > 0 || leadText) && (
          <div className="su-entity-tile__cells">
            <Facts cells={facts} size="compact" />
            {model.cost && <CostBox cost={model.cost} rung="compact" />}
            {leadText && <Lead text={leadText} />}
          </div>
        )}
      </div>
    </LinkSurface>
  )
}
