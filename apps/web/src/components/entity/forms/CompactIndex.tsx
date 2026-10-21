import { useRef } from 'react'
import { budgetFacts, naturalContext } from 'salvageunion-reference'
import { assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'
import { space, widthAtLeast } from '../../../design/tokens'
import { cn } from '../../../lib/cn'
import type { CSSVarStyle } from '../../../styles/cssVars'
import { ChipOverflowRow, MoreChip } from '../../atoms/chipOverflow'
import { useChipFill } from '../../atoms/useChipFill'
import { assetSrcSetFor } from '../../compositions/assetSrcSet'
import { heroArtCrop } from '../../compositions/heroArtCrop'
import { grainClass } from '../../referenceEntity/card/cardGrain'
import { HomebrewStamp } from '../../referenceEntity/card/HomebrewStamp'
import { useEntitySurface } from '../entitySurfaceContext'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { CensorMark } from '../parts/CensorMark'
import { Chips } from '../parts/Chips'
import { censorMark } from '../parts/censor'
import { factCells } from '../parts/factCells'
import { INDEX_NAME, INDEX_NAME_CAPS } from '../parts/indexName'
import { Lead } from '../parts/Lead'
import { paintFor } from '../parts/paint'
import { usePeekAttrs } from '../peekContext'
import type { EntityFormModel, EntityMode, EntityOmit } from '../types'

export type CompactIndexProps = {
  model: EntityFormModel
  /** `link` on a listing; an index Compact has no `select` slot yet. */
  mode?: CompactIndexMode
  omit?: readonly EntityOmit[]
  /** The opening prose under the cells, while browsing (E11). */
  lead?: boolean
  /**
   * The art loads at once and first, for an index Compact in a listing's opening row:
   * that art is the page's largest paint, and a lazy image is only requested
   * after layout.
   */
  priority?: boolean
  /**
   * The catalog has art, so an index Compact without any keeps the art place and wears a
   * censor mark there, keeping every index Compact one height. The number is this
   * entity's place among the catalog's art-less entities, which turns the
   * marks so neighbours differ. Unset, an art-less index Compact opens on its band.
   */
  missingArt?: number
}

type CompactIndexMode = Extract<EntityMode, { kind: 'read' | 'link' }>

const READ: CompactIndexMode = { kind: 'read' }

/**
 * The 440 derivative is the index Compact's own rendition: a catalog column tops out
 * near 22rem, so 440 covers it at 1x–1.25x and 880 at 2x and up. On a phone
 * the art is cropped to its ink in a 2:1 band (`tileArtWindow`), where it
 * draws about half the viewport wide: 50vw is that slot too.
 */
const SIZES = `${widthAtLeast('xl')} 22rem, 50vw`

/**
 * The art's measured ink box (`heroArtCrop`) as custom properties on the
 * tile's art window. Only the phone band reads them (`.su-entity-index__window`
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
    '--su-index-art-left': String(left),
    '--su-index-art-top': String(top),
    '--su-index-art-width': String(width),
    '--su-index-art-height': String(height),
  }
}

/** The key prefix of an entity's measures (`entityStats`): the stats a budget keeps one of. */
const MEASURE_KEY = 'ref-stat-'

/**
 * INDEX COMPACT — the catalog form: the artwork is the hero. The art at 3:4 on paper
 * (the line art multiplied onto it); an entity without art wears a censor
 * mark there in a catalog that has art (`missingArt`), and elsewhere has no
 * art place, so its index Compact opens on the band. Then the tone band with the name notched
 * into its foot on a cut-out of the paper below, in ink — the Workshop
 * Manual's chapter band at an index Compact's scale — with the facts and the cost as
 * chips (`EP | 2`, `SLOTS | 1`), a compact head's budget, beside the name on
 * the band (the name giving way); then, while
 * browsing, the lead clamped to three lines.
 * Layout is `index.css`'s `.su-entity-index*`.
 */
export function CompactIndex({
  model,
  mode = READ,
  omit = [],
  lead = false,
  priority = false,
  missingArt,
}: CompactIndexProps) {
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  // Its name may end in "…": the index Compact Peeks the whole entry (owner, round 4:
  // "should ellipses off and show in a peek").
  const peek = usePeekAttrs(model.ref)
  const paint = paintFor(model.tone, { down: false, texture: surface.texture })
  // An index Compact's budget is a compact head's (C3), in its kind's own context (C4):
  // of its measures (its `ref-stat-*` stats) it keeps the one that context
  // names, beside its rank, its other facts (a hybrid's REQ, a crawler's POP),
  // its action's facets and its cost.
  const kept = budgetFacts(model.facts, naturalContext(model.kind))
  const leadText = lead ? model.lead : undefined
  // An index Compact with no lead to browse by is still contentful when its budget left
  // measures out (owner, round 11: the crawler tech levels "should be
  // contentful"): its head keeps the budget alone (TL, SP), so the name keeps
  // its room, and its body is the rest as chips (Upkeep, Upgrade, POP).
  const spared =
    lead && !leadText && model.facts.some((f) => f.key.startsWith(MEASURE_KEY) && !kept.includes(f))
  const facts = factCells(
    model.facts.filter(
      (fact) => kept.includes(fact) || (!spared && !fact.key.startsWith(MEASURE_KEY))
    ),
    omit
  )
  const spare = spared
    ? factCells(
        model.facts.filter((fact) => !kept.includes(fact)),
        omit
      )
    : []
  const contentful = !!leadText || spare.length > 0
  const { art } = model
  const artWindow = art.kind === 'image' ? tileArtWindow(art.url) : undefined
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
  const hasChips = Boolean(model.cost) || facts.length > 0 || !!model.userMade
  const bandRef = useRef<HTMLDivElement>(null)
  useChipFill(bandRef, hasChips)

  return (
    <LinkSurface
      target={target}
      label={model.title}
      peek={peek}
      className={
        art.kind === 'image' || mark ? 'su-entity-index' : 'su-entity-index su-entity-index--bare'
      }
    >
      <div className="su-entity-index__frame" data-user-made={model.userMade || undefined}>
        {art.kind === 'image' && (
          <span className="su-entity-index__art">
            {artWindow ? (
              <span className="su-entity-index__window" style={artWindow}>
                {image}
              </span>
            ) : (
              image
            )}
          </span>
        )}
        {mark && (
          <span className="su-entity-index__art">
            <CensorMark mark={mark} />
          </span>
        )}
        <div
          ref={bandRef}
          className={cn('su-entity-index__band', grainClass(paint.grain))}
          data-grain={paint.grain}
          data-chip-fill={hasChips ? '' : undefined}
          data-chip-overflow-owner={hasChips && leadText ? '' : undefined}
          style={{
            backgroundColor: paint.background,
            color: paint.color,
            columnGap: space[6],
          }}
        >
          <span className="su-entity-index__notch" data-fill-name="">
            <span
              className={cn('su-entity-index__name', INDEX_NAME_CAPS)}
              title={model.title}
              style={INDEX_NAME}
            >
              {model.title}
            </span>
          </span>
          {hasChips && (
            // Its chips fill from the band's bottom right (ruleset §4.7): the
            // cost in the corner, the rest leftward beside the name, on its
            // line alone; what does not fit goes to the lead's first row, or,
            // with no lead, behind +MORE (C2b, `chipFill.ts`).
            <Chips
              as="span"
              className="su-entity-index__chips"
              size="compact"
              // A player made it: the HOMEBREW stamp leads its chips (ruleset §3.9).
              marks={model.userMade ? <HomebrewStamp size="compact" /> : undefined}
              chips={{
                durations: [],
                facts,
                tags: [],
                ...(model.cost ? { cost: model.cost } : {}),
              }}
              menu={contentful ? undefined : <MoreChip />}
            />
          )}
        </div>
        {hasChips && contentful && <ChipOverflowRow className="su-entity-index__overflow" />}
        {leadText && (
          <div className="su-entity-index__cells">
            <Lead text={leadText} />
          </div>
        )}
        {spare.length > 0 && (
          <div className="su-entity-index__cells">
            <Chips as="span" size="compact" chips={{ durations: [], facts: spare, tags: [] }} />
          </div>
        )}
      </div>
    </LinkSurface>
  )
}
