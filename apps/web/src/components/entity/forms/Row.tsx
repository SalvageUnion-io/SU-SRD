import type { ElementType, ReactNode } from 'react'
import type { ChipContext, EntityInstance } from 'salvageunion-reference'
import { budgetFacts, naturalContext } from 'salvageunion-reference'
import { Stat } from '../../atoms/Stat'
import { CardLabels } from '../../referenceEntity/card/CardLabels'
import { downOf } from '../../referenceEntity/card/cardChrome'
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
 * What a host resolves for the Row (`<Entity form="row">`'s title element,
 * controls, labels, links and trailing chip). A slot set here replaces what
 * the Row would derive from the model and the mode.
 */
type RowSlots = {
  titleAs?: ElementType
  /** The traits, in place of the model's. */
  tags?: TagItem[]
  /** What it is built on or linked to, after the traits (`chips-and-actions.md` C11). */
  relations?: TagItem[]
  /**
   * The host's controls (Assign, Unassign, View), the head's trailing mode
   * slot (E7): at the band's right end, after the affordance. They never
   * nest inside the surface's own control: a link or select Row that has
   * them lays its surface over the frame and raises them above it.
   */
  controls?: ReactNode
  /** The host's labels (an owner stamp): the first chips, before the model's own labels. */
  extraLabels?: ReactNode
  /**
   * The host's state chip (C8): a live reading, a condition, after the cost.
   */
  state?: ReactNode
  /**
   * The host's last chip (a "⋯" menu): after the cost and the state, on the
   * name's line. Raised above a link or select surface, as the controls are.
   */
  trailing?: ReactNode
  /**
   * The host's content leading the body (Play's resolve steps, a seat's
   * mount and vitals): plain content and chips, never an entity (N1).
   */
  leading?: ReactNode
}

export type RowProps = {
  model: EntityRowModel
  /** Where it is drawn (C4): picks the one measure its head keeps; its kind's own by default. */
  context?: ChipContext
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
 * objects (ADR-046, repeated elements). The selection ring and a down row's
 * dimming stay inline.
 */

/**
 * ROW — the workhorse form (entity display language §3): every list of
 * entities. An art column (by schema and room, E10), a head (tier, name, the
 * chip group — stats, action type and facets, traits, relations, cost (E17) — right of the name or
 * under it, the mode's affordance) and, only when something is left to show,
 * a paper body: the host's leading content and the lead while browsing
 * (E11). A bodied
 * head with no chips keeps its tier on the band and sets its name on the paper
 * cut-out notched into the band's foot, as a Tile's. Fill follows kind (E12):
 * a "have" entity's tone, an ability's tier tone (Core orange, Advanced
 * and Hybrid rust, Legendary pink), any other "do" entity's ink banner with paper flecks.
 */
export function Row({
  model,
  context,
  instance,
  mode = READ,
  lead = false,
  omit = [],
  peek = false,
  slots = {},
}: RowProps) {
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  const down = downOf(instance?.condition)
  const peekAttrs = usePeekAttrs(peek ? model.ref : undefined, undefined, down)
  const ability = model.ref.schemaName === 'abilities'
  // An ability's Row wears its tier tone (E12); any other "do" entity the ink banner.
  const fill = model.kind.nature === 'do' && !ability ? 'ink' : model.tone
  const paint = paintFor(fill, { down, texture: surface.texture })
  const userMade = !!(model.userMade || instance?.userMade)
  const title = instance?.title ?? model.title
  const selected = mode.kind === 'select' && mode.selected

  const chips: ChipSet = {
    durations: actionTypeStamps(model.actionType, model.mechActionType),
    ...(model.cost ? { cost: model.cost } : {}),
    facts: factCells(budgetFacts(model.facts, context ?? naturalContext(model.kind)), omit),
    tags: slots.tags ?? traitTags(model.traits),
    ...(slots.relations ? { relations: slots.relations } : {}),
  }
  const leadText = lead ? model.lead : undefined
  const hasBody = !!slots.leading || !!leadText
  const affordance =
    mode.kind === 'select' && mode.role === 'toggle' ? (
      // A toggle's control is a real checkbox; the seal still marks the pick.
      <>
        {selected && <SelectedSeal word={mode.seal} />}
        <SelectCheck mode={mode} label={mode.label ?? title} accent={paint.color} />
      </>
    ) : selected ? (
      <SelectedSeal word={mode.seal} />
    ) : undefined
  const note = omit.includes('kind') ? undefined : model.kind.note
  // The model's own labels (a unit's note, the User-made stamp): `CardLabels`
  // draws them only when there is a note or the Row is user-made.
  const ownLabels =
    userMade || note ? (
      <CardLabels
        seal={undefined}
        note={note}
        axisMarkers={[]}
        legalStartingPattern={false}
        userMade={userMade}
      />
    ) : null
  // Beside chips, or with the host's, the labels are chips: the first items
  // of the chip group, wrapping and centring with the rest, never a line of
  // their own (owner's rule, 2026-10-14). The host's (an owner chip) lead,
  // then the note as a label-only chip (★ Primary), then User-made, a
  // label-only chip too (the dashed frame already says pencil, not print).
  const labelsAsChips =
    (!!ownLabels || !!slots.extraLabels) &&
    (chipCount(chips) > 0 || !!slots.extraLabels || !!slots.trailing || !!slots.state)
  // The marks lane (C2): the host's, then the note, then User-made.
  const marks = labelsAsChips
    ? [
        slots.extraLabels,
        note && <Stat key="note" orientation="horizontal" label={note} size="compact" />,
        userMade && (
          <Stat key="user-made" orientation="horizontal" label="User-made" size="compact" />
        ),
      ]
    : undefined

  const frame = (
    <div
      className="su-entity-row__frame"
      data-user-made={userMade || undefined}
      data-bodyless={!hasBody || undefined}
      style={selected ? SELECTED_RING : undefined}
    >
      {!omit.includes('art') && <Art art={model.art} />}
      <div className="su-entity-row__main">
        <Head
          title={title}
          kind={omit.includes('kind') ? undefined : model.kind.stamp}
          titleAs={slots.titleAs}
          paint={paint}
          tier={omit.includes('tier') ? undefined : model.tier}
          chips={
            chipCount(chips) > 0 || labelsAsChips || slots.trailing || slots.state ? (
              <Chips
                chips={chips}
                size="compact"
                linkable={mode.kind === 'read'}
                marks={marks}
                state={slots.state}
                menu={slots.trailing}
              />
            ) : undefined
          }
          affordance={affordance}
          controls={slots.controls}
          labels={labelsAsChips ? undefined : ownLabels}
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

  // A Row with controls, or a link Row with host labels or a trailing chip that
  // may be one (an owner seal that claims, a "⋯" menu), never nests them in its
  // own control (a link's `<a>`, a radio): the surface is an empty cover laid
  // over the frame, and the controls, the chips' own controls (and a toggle's
  // check) are raised above it (`[data-covered]`).
  const covered =
    (!!slots.controls && mode.kind !== 'read') ||
    ((!!slots.extraLabels || !!slots.trailing || !!slots.state) && mode.kind === 'link')
  if (covered) {
    return (
      <div className="su-entity-row" data-covered="">
        {frame}
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
  if (mode.kind === 'select') {
    return (
      <SelectSurface mode={mode} label={mode.label ?? title} className="su-entity-row">
        {frame}
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
      {frame}
    </LinkSurface>
  )
}
