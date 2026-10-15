import { space } from '../../../design/tokens'
import { cn } from '../../../lib/cn'
import type { CSSVarStyle } from '../../../styles/cssVars'
import { assetDerivativeUrl, assetSrcSetFor } from '../../compositions/assetSrcSet'
import { heroArtCrop } from '../../compositions/heroArtCrop'
import { grainClass } from '../../referenceEntity/card/cardGrain'
import { useEntitySurface } from '../entitySurfaceContext'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { CensorMark } from '../parts/CensorMark'
import { CostBox } from '../parts/Chips'
import { censorMark } from '../parts/censor'
import { Facts } from '../parts/Facts'
import { factCells } from '../parts/factCells'
import { Lead } from '../parts/Lead'
import { paintFor } from '../parts/paint'
import { TILE_NAME } from '../parts/tileName'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

export type TileProps = {
  model: EntityRowModel
  /** `link` on a listing; a tile has no `select` slot yet. */
  mode?: TileMode
  omit?: readonly EntityOmit[]
  /** The opening prose under the cells, while browsing (E11). */
  lead?: boolean
  /**
   * The art loads at once and first, for a tile in a listing's opening row:
   * that art is the page's largest paint, and a lazy image is only requested
   * after layout.
   */
  priority?: boolean
  /**
   * The catalog has art, so a tile without any keeps the art place and wears a
   * censor mark there, keeping every tile one height. The number is this
   * entity's place among the catalog's art-less entities, which turns the
   * marks so neighbours differ. Unset, an art-less tile opens on its band.
   */
  missingArt?: number
}

type TileMode = Extract<EntityMode, { kind: 'read' | 'link' }>

const READ: TileMode = { kind: 'read' }

/**
 * The 440 derivative is the tile's own rendition: a catalog column tops out
 * near 22rem, so 440 covers it at 1x–1.25x and 880 at 2x and up. On a phone
 * the art is cropped to its ink in a 2:1 band (`tileArtWindow`), where it
 * draws about half the viewport wide: 50vw is that slot too.
 */
const SIZES = '(min-width: 75rem) 22rem, 50vw'

/**
 * The art's measured ink box (`heroArtCrop`) as custom properties on the
 * tile's art window. Only the phone band reads them (`.su-entity-tile__window`
 * in `entity-forms.css`): there the window takes the ink's aspect inside the
 * short band and the canvas's empty margin falls outside it, so a mech is
 * never cut off. At wider widths the window is `display: contents` and the
 * art draws whole at 3:4, as before. Unmeasured art has no window and draws
 * whole in the band.
 */
function tileArtWindow(url: string): CSSVarStyle | undefined {
  const crop = heroArtCrop(url)
  if (!crop) return undefined
  const { left, top, width, height } = crop.image
  return {
    ...crop.frame,
    '--su-tile-art-left': String(left),
    '--su-tile-art-top': String(top),
    '--su-tile-art-width': String(width),
    '--su-tile-art-height': String(height),
  }
}

/**
 * Systems and modules: their catalog chips keep to two lines (owner,
 * 2026-10-14) and leave out the salvage values, which their Rows and Pages
 * carry.
 */
const GEAR: ReadonlySet<string> = new Set(['systems', 'modules'])
const GEAR_HIDDEN: ReadonlySet<string> = new Set(['SV', 'Bio'])

/**
 * TILE — the catalog form: the artwork is the hero. The art at 3:4 on paper
 * (the line art multiplied onto it); an entity without art wears a censor
 * mark there in a catalog that has art (`missingArt`), and elsewhere has no
 * art place, so its tile opens on the band. Then the tone band with the name notched
 * into its foot on a cut-out of the paper below, in ink — the Workshop
 * Manual's chapter band at a tile's scale — with the facts and the cost as
 * chips (`EP | 2`, `SLOTS | 1`) beside the name on the band (a system's or
 * module's on at most two lines, the name giving way); then, while
 * browsing, the lead clamped to three lines.
 * Layout is `index.css`'s `.su-entity-tile*`.
 */
export function Tile({
  model,
  mode = READ,
  omit = [],
  lead = false,
  priority = false,
  missingArt,
}: TileProps) {
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  const paint = paintFor(model.tone, { down: false, texture: surface.texture })
  const gear = GEAR.has(model.ref.schemaName)
  const facts = factCells(model.facts, omit).filter(
    (cell) => !(gear && GEAR_HIDDEN.has(cell.label))
  )
  const { art } = model
  const artWindow = art.kind === 'image' ? tileArtWindow(art.url) : undefined
  const leadText = lead ? model.lead : undefined
  const mark =
    art.kind === 'none' && missingArt !== undefined
      ? censorMark(`${model.ref.schemaName}/${model.ref.id}`, missingArt, model.cite?.page)
      : undefined
  const image =
    art.kind === 'image' ? (
      <img
        src={assetDerivativeUrl(art.url, 440)}
        srcSet={assetSrcSetFor(art.url)}
        sizes={SIZES}
        width={440}
        height={587}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    ) : null
  const hasChips = Boolean(model.cost) || facts.length > 0
  const chips = [
    ...facts.map((cell) => <Facts key={cell.key} cells={[cell]} size="compact" />),
    ...(model.cost ? [<CostBox key="cost" cost={model.cost} rung="compact" />] : []),
  ]
  // Gear's chips keep to two lines, the first the longer half; the name gives way.
  const half = gear && chips.length > 2 ? Math.ceil(chips.length / 2) : 0

  return (
    <LinkSurface
      target={target}
      label={model.title}
      className={
        art.kind === 'image' || mark ? 'su-entity-tile' : 'su-entity-tile su-entity-tile--bare'
      }
    >
      <div className="su-entity-tile__frame" data-user-made={model.userMade || undefined}>
        {art.kind === 'image' && (
          <span className="su-entity-tile__art">
            {artWindow ? (
              <span className="su-entity-tile__window" style={artWindow}>
                {image}
              </span>
            ) : (
              image
            )}
          </span>
        )}
        {mark && (
          <span className="su-entity-tile__art">
            <CensorMark mark={mark} />
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
            <span className="su-entity-tile__name" title={model.title} style={TILE_NAME}>
              {model.title}
            </span>
          </span>
          {hasChips && (
            <span
              className={cn('su-entity-tile__chips', half > 0 && 'su-entity-tile__chips--lines')}
            >
              {half > 0 ? (
                <>
                  <span className="su-entity-tile__line">{chips.slice(0, half)}</span>
                  <span className="su-entity-tile__line">{chips.slice(half)}</span>
                </>
              ) : (
                chips
              )}
            </span>
          )}
        </div>
        {leadText && (
          <div className="su-entity-tile__cells">
            <Lead text={leadText} />
          </div>
        )}
      </div>
    </LinkSurface>
  )
}
