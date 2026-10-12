import type { CSSProperties, ElementType, ReactNode } from 'react'
import type { EntityInstance } from 'salvageunion-reference'
import type { StatItem } from '../../components/containers/statsBarTypes'
import { CardLabels } from '../../components/referenceEntity/card/CardLabels'
import type { CardOuterProps } from '../../components/referenceEntity/card/CardOuter'
import { CardOuter } from '../../components/referenceEntity/card/CardOuter'
import { CardPennant } from '../../components/referenceEntity/card/CardPennant'
import { space } from '../../design/tokens'
import { useEntitySurface } from '../entitySurfaceContext'
import { LinkChevron, LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { SelectCheck, SelectedSeal, SelectSurface } from '../modes/select'
import { SELECTED_RING } from '../modes/selectedRing'
import { Art } from '../parts/Art'
import { actionTypeStamps } from '../parts/actionStamps'
import { Facts } from '../parts/Facts'
import { factCells } from '../parts/factCells'
import { Head } from '../parts/Head'
import { Lead } from '../parts/Lead'
import { paintFor } from '../parts/paint'
import { Tags } from '../parts/Tags'
import type { TagItem } from '../parts/tagItems'
import { traitTags } from '../parts/tagItems'
import { usePeekAttrs } from '../peekContext'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

/**
 * What the `ReferenceEntityCard` adapter resolves for itself (its `extent="head"`
 * props, translated), until phase 6 deletes it. A slot set here replaces what
 * the Row would derive from the model and the mode.
 */
export type RowSlots = {
  /** The card's interaction wrapper (`resolveCardInteraction`), in place of the mode's. */
  outer?: CardOuterProps
  /** The card's frame (its weight, dash and selection ring). */
  frameStyle?: CSSProperties
  /** The card's labels (right of the name); `null` for none. */
  labels?: ReactNode
  /** The card's top-right control rail. */
  rail?: ReactNode
  titleSlot?: ReactNode
  titleAs?: ElementType
  facts?: StatItem[]
  tags?: TagItem[]
  stamps?: string[]
  /** A stamp leading the body ("Suggested"). */
  leading?: ReactNode
  hint?: ReactNode
  pennant?: ReactNode
  chevron?: boolean
  /** `false` drops the art column (a pattern row, `hide.image`). */
  art?: boolean
  /** A row that is its head alone. */
  bodyless?: boolean
  down?: boolean
}

export type RowProps = {
  model: EntityRowModel
  instance?: EntityInstance
  mode?: EntityMode
  /** The opening prose, in browse contexts only (E11). */
  lead?: boolean
  /** Facts by key to leave out, `kind` for the type stamp, `art` for the art column. */
  omit?: readonly EntityOmit[]
  /** Hover, focus or a long press Peeks the Row (a pattern's loadout). Off in listings. */
  peek?: boolean
  /**
   * A "do" entity's head wears its own tone instead of the ink banner: an
   * ability's tier fill (Core brick, Advanced pilot, Legendary crawler), where
   * the tiers are the point (a class page's trees).
   */
  toned?: boolean
  slots?: RowSlots
}

const READ: EntityMode = { kind: 'read' }

const BODY: CSSProperties = {
  alignContent: 'flex-start',
  alignItems: 'center',
  borderTop: 'var(--bw-chrome) solid var(--color-ink)',
  display: 'flex',
  flex: '1 1 auto',
  flexWrap: 'wrap',
  gap: space[4],
  padding: `${space[4]} ${space[10]} ${space[6]}`,
}

/** The frame: ink on paper, dashed when player-made (ruleset §3.9). */
function frameOf(userMade: boolean, selected: boolean): CSSProperties {
  return {
    backgroundColor: 'var(--color-paper)',
    borderColor: 'var(--color-ink)',
    borderRadius: 'var(--radius-card)',
    borderStyle: userMade ? 'dashed' : 'solid',
    borderWidth: 'var(--bw-entity-compact)',
    overflow: 'hidden',
    ...(selected ? SELECTED_RING : {}),
  }
}

/**
 * ROW — the workhorse form (entity display language §3): every list of
 * entities. An art column (by schema and room, E10), a head (tier, name,
 * action-type stamp, cost pennant, the mode's affordance) and a paper body
 * whose first row is the facts and facets as Stats, then the traits as Tags
 * (E17: no "//" line), then the lead while browsing (E11). Fill follows kind
 * (E12): a "have" entity's tone, a "do" entity's ink banner with paper flecks
 * (ruleset §3.1: the Core tier fill is rust's near twin); an ability's tier
 * rides on its numeral and pennant.
 */
export function Row({
  model,
  instance,
  mode = READ,
  lead = false,
  omit = [],
  peek = false,
  toned = false,
  slots = {},
}: RowProps) {
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  const peekAttrs = usePeekAttrs(peek ? model.ref : undefined)
  const down =
    slots.down ?? (instance?.condition === 'damaged' || instance?.condition === 'destroyed')
  const fill = model.kind.nature === 'do' && !toned ? 'ink' : model.tone
  const paint = paintFor(fill, { down, texture: surface.texture })
  const userMade = !!(model.userMade || instance?.userMade || surface.userMade)
  const title = instance?.title ?? model.title
  const selected = mode.kind === 'select' && mode.selected

  const facts = slots.facts ?? factCells(model.facts, omit)
  const tags = slots.tags ?? traitTags(model.traits)
  const leadText = lead ? model.lead : undefined
  const hasBody =
    !slots.bodyless && (facts.length > 0 || tags.length > 0 || !!slots.leading || !!leadText)

  const pennant =
    slots.pennant ??
    (model.cost ? <CardPennant cost={model.cost} size="medium" subject={title} /> : undefined)
  const affordance =
    slots.chevron || target.href || target.onOpen ? (
      <LinkChevron />
    ) : mode.kind === 'select' && mode.role === 'toggle' && !slots.outer ? (
      // A toggle's control is a real checkbox; the seal still marks the pick.
      <>
        {selected && <SelectedSeal word={mode.seal} />}
        <SelectCheck mode={mode} label={mode.label ?? title} accent={paint.color} />
      </>
    ) : selected ? (
      <SelectedSeal word={mode.seal} />
    ) : undefined
  const labels =
    slots.labels !== undefined ? (
      slots.labels
    ) : omit.includes('kind') && !userMade ? null : (
      <CardLabels
        seal={undefined}
        typeStamp={omit.includes('kind') ? undefined : model.kind.stamp}
        axisMarkers={[]}
        legalStartingPattern={false}
        userMade={userMade}
        onInk={paint.ink}
      />
    )

  const frame = (
    <div
      className="su-entity-row__frame"
      data-user-made={userMade || undefined}
      data-bodyless={!hasBody || undefined}
      style={{ ...frameOf(userMade, selected), ...slots.frameStyle }}
    >
      {slots.art !== false && !omit.includes('art') && <Art art={model.art} />}
      <div className="su-entity-row__main">
        <Head
          title={title}
          titleAs={slots.titleAs}
          titleSlot={slots.titleSlot}
          paint={paint}
          tier={model.tier}
          stamps={slots.stamps ?? actionTypeStamps(model.actionType, model.mechActionType)}
          hint={slots.hint}
          pennant={pennant}
          affordance={affordance}
          labels={labels}
        />
        {hasBody && (
          <div
            className="su-entity-row__body"
            style={{ ...BODY, ...(down ? { opacity: 0.6 } : {}) }}
          >
            {slots.leading}
            <Facts cells={facts} />
            <Tags tags={tags} linkable={mode.kind === 'read' && !slots.outer} />
            {leadText && <Lead text={leadText} />}
          </div>
        )}
      </div>
    </div>
  )
  const parts = (
    <>
      {slots.rail}
      {frame}
    </>
  )

  if (slots.outer) {
    return (
      <CardOuter {...slots.outer} className={`${slots.outer.className} su-entity-row`}>
        {parts}
      </CardOuter>
    )
  }
  if (mode.kind === 'select') {
    return (
      <SelectSurface mode={mode} label={mode.label ?? title} className="su-entity-row">
        {parts}
      </SelectSurface>
    )
  }
  return (
    <LinkSurface
      target={target}
      label={title}
      attrs={mode.kind === 'link' ? mode.attrs : undefined}
      peek={peekAttrs}
      className="su-entity-row"
    >
      {parts}
    </LinkSurface>
  )
}
