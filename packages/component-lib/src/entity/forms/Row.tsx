import type { CSSProperties, ElementType, ReactNode } from 'react'
import type { EntityInstance } from 'salvageunion-reference'
import type { StatItem } from '../../components/containers/statsBarTypes'
import { CardLabels } from '../../components/referenceEntity/card/CardLabels'
import type { CardOuterProps } from '../../components/referenceEntity/card/CardOuter'
import { CardOuter } from '../../components/referenceEntity/card/CardOuter'
import type { Down } from '../../components/referenceEntity/card/cardChrome'
import { downOf } from '../../components/referenceEntity/card/cardChrome'
import { useEntitySurface } from '../entitySurfaceContext'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { SelectCheck, SelectedSeal, SelectSurface } from '../modes/select'
import { SELECTED_RING } from '../modes/selectedRing'
import { Art } from '../parts/Art'
import { actionTypeStamps } from '../parts/actionStamps'
import { Chips } from '../parts/Chips'
import type { ChipSet } from '../parts/chipSet'
import { chipCount } from '../parts/chipSet'
import { factCells } from '../parts/factCells'
import { Head } from '../parts/Head'
import { Lead } from '../parts/Lead'
import { paintFor } from '../parts/paint'
import type { TagItem } from '../parts/tagItems'
import { traitTags } from '../parts/tagItems'
import { usePeekAttrs } from '../peekContext'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

/**
 * What the `ReferenceEntityCard` adapter resolves for itself (its `extent="head"`
 * props, translated). A slot set here replaces what
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
  titleAs?: ElementType
  facts?: StatItem[]
  tags?: TagItem[]
  /** The action types, as the book prints them ("Turn Action"). */
  durations?: string[]
  /** The cost as printed ("2 EP"), a chip; `null` for none. */
  cost?: string | null
  /** A stamp leading the body ("Suggested"). */
  leading?: ReactNode
  hint?: ReactNode
  /** The Dashboard's pennant button (a read cost is a chip). */
  pennant?: ReactNode
  /** `false` drops the art column (a pattern row, `hide.image`). */
  art?: boolean
  /** A row that is its head alone. */
  bodyless?: boolean
  down?: Down
  /**
   * The host's controls (Assign, Unassign, View), the head's trailing mode
   * slot (E7): at the band's right end, after the affordance. They never
   * nest inside the surface's own control: a link or select Row that has
   * them lays its surface over the frame and raises them above it.
   */
  controls?: ReactNode
  /** The host's labels, right of the title after the model's own (an owner stamp). */
  extraLabels?: ReactNode
}

export type RowProps = {
  model: EntityRowModel
  instance?: EntityInstance
  mode?: EntityMode
  /** The opening prose, in browse contexts only (E11). */
  lead?: boolean
  /**
   * Facts by key to leave out, `kind` for the type stamp, `art` for the art
   * column, `tier` for an ability's numeral (a class page sets it on the track).
   */
  omit?: readonly EntityOmit[]
  /** Hover, focus or a long press Peeks the Row (a pattern's loadout). Off in listings. */
  peek?: boolean
  slots?: RowSlots
}

const READ: EntityMode = { kind: 'read' }

/*
 * The frame (ink on paper, dashed when player-made: ruleset §3.9) and the body
 * are `.su-entity-row__frame` / `__body` classes (`styles/index.css`): every
 * row of a listing repeats them, so they are stylesheet rules, not style
 * objects (ADR-046, repeated elements). The selection ring, a caller's frame
 * and a down row's dimming stay inline.
 */

/**
 * ROW — the workhorse form (entity display language §3): every list of
 * entities. An art column (by schema and room, E10), a head (tier, name, the
 * chip group — stats, action type and facets, traits, cost (E17) — right of the name or
 * under it, the mode's affordance) and, only when something is left to show,
 * a paper body: a leading stamp and the lead while browsing (E11). A bodied
 * head with no chips keeps its tier on the band and sets its name on the paper
 * cut-out notched into the band's foot, as a Tile's. Fill follows kind (E12):
 * a "have" entity's tone, an ability's tier tone (Core orange, Advanced
 * and Hybrid rust, Legendary pink), any other "do" entity's ink banner with paper flecks.
 */
export function Row({
  model,
  instance,
  mode = READ,
  lead = false,
  omit = [],
  peek = false,
  slots = {},
}: RowProps) {
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  const down = slots.down ?? downOf(instance?.condition)
  const peekAttrs = usePeekAttrs(peek ? model.ref : undefined, undefined, down)
  const ability = model.ref.schemaName === 'abilities'
  // An ability's Row wears its tier tone (E12); any other "do" entity the ink banner.
  const fill = model.kind.nature === 'do' && !ability ? 'ink' : model.tone
  const paint = paintFor(fill, { down, texture: surface.texture })
  const userMade = !!(model.userMade || instance?.userMade)
  const title = instance?.title ?? model.title
  const selected = mode.kind === 'select' && mode.selected

  const cost = slots.cost === undefined ? model.cost : (slots.cost ?? undefined)
  const chips: ChipSet = {
    durations: slots.durations ?? actionTypeStamps(model.actionType, model.mechActionType),
    ...(cost ? { cost } : {}),
    facts: slots.facts ?? factCells(model.facts, omit),
    tags: slots.tags ?? traitTags(model.traits),
  }
  const leadText = lead ? model.lead : undefined
  const hasBody = !slots.bodyless && (!!slots.leading || !!leadText)
  const affordance =
    mode.kind === 'select' && mode.role === 'toggle' && !slots.outer ? (
      // A toggle's control is a real checkbox; the seal still marks the pick.
      <>
        {selected && <SelectedSeal word={mode.seal} />}
        <SelectCheck mode={mode} label={mode.label ?? title} accent={paint.color} />
      </>
    ) : selected ? (
      <SelectedSeal word={mode.seal} />
    ) : undefined
  const ownLabels =
    slots.labels !== undefined ? (
      slots.labels
    ) : omit.includes('kind') && !userMade ? null : (
      <CardLabels
        seal={undefined}
        note={model.kind.note}
        axisMarkers={[]}
        legalStartingPattern={false}
        userMade={userMade}
        onInk={paint.ink}
      />
    )
  const labels = slots.extraLabels ? (
    <>
      {ownLabels}
      {slots.extraLabels}
    </>
  ) : (
    ownLabels
  )

  const frame = (
    <div
      className="su-entity-row__frame"
      data-user-made={userMade || undefined}
      data-bodyless={!hasBody || undefined}
      style={
        selected || slots.frameStyle
          ? { ...(selected ? SELECTED_RING : {}), ...slots.frameStyle }
          : undefined
      }
    >
      {slots.art !== false && !omit.includes('art') && <Art art={model.art} />}
      <div className="su-entity-row__main">
        <Head
          title={title}
          kind={omit.includes('kind') ? undefined : model.kind.stamp}
          titleAs={slots.titleAs}
          paint={paint}
          tier={omit.includes('tier') ? undefined : model.tier}
          chips={
            chipCount(chips) > 0 ? (
              <Chips
                chips={chips}
                rung="compact"
                onInk={paint.ink}
                linkable={mode.kind === 'read' && !slots.outer}
              />
            ) : undefined
          }
          hint={slots.hint}
          pennant={slots.pennant}
          affordance={affordance}
          controls={slots.controls}
          labels={labels}
          // Every Row wears the cut-out, bodied or not, its chips on the band
          // beside the name (owner's call, 2026-10-13).
          notch
          chipsBeside
        />
        {hasBody && (
          <div className="su-entity-row__body" style={down ? { opacity: 0.6 } : undefined}>
            {slots.leading}
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

  // A Row with controls never nests them in its own control (a link's `<a>`, a
  // radio): the surface is an empty cover laid over the frame, and the
  // controls (and a toggle's check) are raised above it (`[data-covered]`).
  const covered = !!slots.controls && !slots.outer && mode.kind !== 'read'
  if (covered) {
    return (
      <div className="su-entity-row" data-covered="">
        {parts}
        {mode.kind === 'select' ? (
          <SelectSurface mode={mode} label={mode.label ?? title} className="su-entity-row__cover">
            {null}
          </SelectSurface>
        ) : (
          <LinkSurface
            target={target}
            label={title}
            attrs={mode.kind === 'link' ? mode.attrs : undefined}
            peek={peekAttrs}
            className="su-entity-row__cover"
          >
            {null}
          </LinkSurface>
        )}
      </div>
    )
  }
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
