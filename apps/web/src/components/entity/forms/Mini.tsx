import type { ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'
import type { ChipContext, EntityInstance } from 'salvageunion-reference'
import { tokenChips } from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import { Badge } from '../../atoms/Badge'
import { capsLabel } from '../../atoms/capsLabel'
import { ChipOverflowRow } from '../../atoms/chipOverflow'
import { FOCUS_RING } from '../../atoms/interaction'
import { Stat } from '../../atoms/Stat'
import { Content } from '../../referenceEntity/Content'
import { downOf, USER_MADE_TITLE } from '../../referenceEntity/card/cardChrome'
import { HomebrewStamp } from '../../referenceEntity/card/HomebrewStamp'
import { TraitProse } from '../../TraitProse'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { SELECT_DIM, SELECTED_RING } from '../modes/selectedRing'
import { toggleAttrs } from '../modes/toggle'
import { ProseOwnerContext } from '../nameRefs'
import { Chips } from '../parts/Chips'
import { watchTokenOverflow } from '../parts/chipFit'
import { chipCount } from '../parts/chipSet'
import { KindLabel } from '../parts/KindLabel'
import { paintFor } from '../parts/paint'
import type { TagItem } from '../parts/tagItems'
import { tokenChipSet } from '../parts/tokenChipSet'
import type { PeekAttrs } from '../peekContext'
import { useInsidePeek, usePeekAttrs } from '../peekContext'
import type { EntityFormModel, EntityMode, EntityOmit } from '../types'

/** The pill sets its name and chips in the caps recipe. */
const PILL = cn('su-entity-mini__pill', capsLabel())

/** The host's parts in the Mini's chip group and lanes (`<Entity size="mini">` fills them). */
export type MiniSlots = {
  /** Peek this address in place of the entity's own (`embeddedPeekAddress`). */
  peekAt?: string
  /**
   * Paint its band in this tone dulled toward grey, in place of its own: a
   * thing you do in Play wears the unit it comes from (pilot, mech, crawler),
   * at a distance, never black.
   */
  tint?: string
  /**
   * What it is linked to, as relation chips before the cost (C11): a crewmate's
   * `MECH | Scrapper`. Where its host names it (Play's Crew, R5), never a stamp.
   */
  relations?: TagItem[]
  /** The host's state chip, after the cost box (C8): a damaged thing's condition, a reading. */
  state?: ReactNode
  /** Its state chip is a control (a condition that steps): the Mini then acts, as with `uses`. */
  stateActs?: boolean
  /** The uses slot after the state (C8): a live sheet item's `USES | 3/5` stepper. */
  uses?: ReactNode
  /**
   * The last slot (C8): the host's actions and its ✕, at the Mini's Size.
   * A Mini with controls (this, `uses` or a `stateActs` state) is a `div` whose NAME is the link
   * and the Peek trigger, so no control sits inside a link
   * (`chips-and-actions.md`, "A Mini with actions").
   */
  menu?: ReactNode
}

/**
 * A CONTENTFUL Mini's body (N3): what it draws under its one-row head,
 * bordered in its tone, with no band. A Mini without one is its head alone.
 */
export type MiniBody = {
  /**
   * The entity's own text, from its model: its prose (an action's rules,
   * every paragraph), else its lead (an ability's description). Default
   * `true`; `false` when the host's content is the whole body.
   */
  text?: boolean
  /** The name `[(CHASSIS)]` reads as in the text: a chassis ability's chassis (the card's `chassisName`). */
  chassisName?: string
  /**
   * The host's content, after the text: a crew lead's keepsake, motto and
   * facts and, in Edit, their fields. Never an entity (a Mini nests
   * nothing, E6), and inside a Peek read-only (E16).
   */
  children?: ReactNode
}

const READ: EntityMode = { kind: 'read' }

/** The text under a contentful Mini's head: the model's prose, else its lead. */
function MiniText({ model, chassisName }: { model: EntityFormModel; chassisName?: string }) {
  if (model.prose?.length) return <Content body={model.prose} chassisName={chassisName} />
  return model.lead ? (
    <TraitProse as="p" className="su-entity-mini__lead" text={model.lead} />
  ) : null
}

type ToggleMode = Extract<EntityMode, { kind: 'select' }>

/** The toggle Mini's surface (`toggleAttrs`): where the link would stand, pressed while chosen. */
function ToggleSurface({
  mode,
  label,
  peek,
  className,
  children,
}: {
  mode: ToggleMode
  label: string
  peek: PeekAttrs
  className: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(className, FOCUS_RING)}
      {...toggleAttrs({ pressed: mode.selected, onToggle: mode.onSelect, label })}
      {...peek}
    >
      {children}
    </div>
  )
}

/*
 * The pill, its note stamp and its name are `.su-entity-mini__*` classes
 * (`styles/partials/entity-forms.css`), not style objects: a page lists tokens by the dozen,
 * so inline they repeated on every one (ADR-046, repeated elements). The
 * pill's paint and a caller's frame stay inline; a player-made pill's dashes
 * ride `data-user-made`.
 */

/**
 * MINI — the shortform (§3): `name [chips]`, one size, at level 2 (E6) or in
 * a slot under 12rem (E3). Its chips are the budget its container's context
 * names (`tokenChips`, C3 and C4), then the cost box; an ability's tier numeral sits before
 * its name, as on its band. Its head is always one row (E18): every chip of
 * its static budget whole (C3), never dropped or clipped, and the name takes
 * the rest, ending in "…" when that is too little (C5). Its kind is never
 * stamped (E9): screen readers hear it after the name (`KindLabel`); a player
 * unit's note ("Engineer") leads in its place. A tone pill for a thing you have, the tier
 * tone or ink for a thing you do, dashed when player-made. It fills its line,
 * one a line in a list (N4), its chips at the right end; in link mode it
 * opens its entity. Hover, focus or a long press Peeks it: the whole card,
 * read-only (E16).
 *
 * With a `body` it is CONTENTFUL (N3): that head, then the entity's text and
 * the host's content under it, held by a border in its tone (the class page's
 * ability track is the look). Only the head is the link and the Peek trigger,
 * so the body's own Mentions and fields never nest in it; inside a Peek the
 * head is read-only too (E16).
 *
 * In select mode it is the TOGGLE Mini (EDL Modes, `role: 'toggle'`): its
 * surface (or, with controls, its name) is pressed while chosen, the ring on
 * its pill, never a seal; a radio or checkbox select stays a Compact's (N7).
 * `dim` is its host's one dim (`SELECT_DIM`): an unchosen toggle beside a
 * chosen one, a Play action not on hand. Read-only, a `chosen` Mini (a choice's
 * picked option) wears the same ring with no surface to press.
 */
export function Mini({
  model,
  context,
  instance,
  mode = READ,
  omit = [],
  slots = {},
  body,
  dim = false,
  chosen = false,
}: {
  model: EntityFormModel
  /** Where it is drawn (C4): picks the one fact its context lane carries. */
  context: ChipContext
  instance?: EntityInstance
  mode?: EntityMode
  /** Facts the context already states, by key (`tech-level`), left off its chips. */
  omit?: readonly EntityOmit[]
  slots?: MiniSlots
  /** N3: the text and the host's content under the head; without it the Mini is its head alone. */
  body?: MiniBody
  /** Its host's one dim (`SELECT_DIM`): unchosen beside a chosen toggle, not on hand. */
  dim?: boolean
  /** Read-only, a choice's picked option: select's ring on its pill (R15), never a seal. */
  chosen?: boolean
}) {
  const contentfulRef = useRef<HTMLDivElement>(null)
  // Every commit: the chips may have changed (C2b's fit starts from them all).
  useLayoutEffect(() => {
    const token = contentfulRef.current
    return token ? watchTokenOverflow(token) : undefined
  })
  const insidePeek = useInsidePeek()
  // A contentful Mini in a Peek reads (E16): its head opens nothing.
  const headMode = body && insidePeek ? READ : mode
  const toggle = headMode.kind === 'select' && headMode.role === 'toggle' ? headMode : null
  const target = useLinkTarget(headMode, model.ref)
  const down = downOf(instance?.condition)
  const peek = usePeekAttrs(model.ref, slots.peekAt, down)
  const paint = slots.tint
    ? paintFor(slots.tint, { down: down === 'destroyed' ? down : true, texture: false })
    : paintFor(model.tone, { down, texture: false })
  const userMade = !!(model.userMade || instance?.userMade)
  const title = instance?.title ?? model.title
  const chips = tokenChips(model, context, {
    omit,
    contentful: !!body,
    ...(instance?.count !== undefined ? { count: instance.count } : {}),
  })
  const own = tokenChipSet(chips, chips.cost)
  const quantity = own.quantity
  const set = slots.relations?.length ? { ...own.set, relations: slots.relations } : own.set
  const state = [
    quantity && <Stat key="quantity" label={quantity.label} value={quantity.value} size="mini" />,
    slots.state,
  ]
  // A relation that Peeks or opens is a control of its own: the name is then
  // the link, so it never nests in one (C11).
  const linkedRelation = !!slots.relations?.some((r) => r.ref || r.href)
  const acts =
    slots.uses !== undefined || slots.menu !== undefined || !!slots.stateActs || linkedRelation
  const hasChips = chipCount(set) > 0 || !!quantity || !!slots.state || acts || userMade
  /** The name, or the whole surface: a toggle, a link, or plain. */
  const surface = (className: string, children: ReactNode, surfacePeek: PeekAttrs) =>
    toggle ? (
      <ToggleSurface
        mode={toggle}
        label={toggle.label ?? title}
        peek={surfacePeek}
        className={className}
      >
        {children}
      </ToggleSurface>
    ) : (
      <LinkSurface
        target={target}
        label={title}
        attrs={headMode.kind === 'link' ? headMode.attrs : undefined}
        peek={surfacePeek}
        className={className}
      >
        {children}
      </LinkSurface>
    )
  const pill = (
    <span
      // The pill is the frame: on an ink pill (a thing you do) its cells,
      // stamp and cost box read the ground in CSS (chrome K1).
      data-ground={paint.ink ? 'ink' : undefined}
      data-user-made={userMade || undefined}
      title={userMade ? USER_MADE_TITLE : undefined}
      className={PILL}
      // Print hands the pill its own type back and inks its frame (`print.css`).
      data-handback=""
      style={{
        backgroundColor: paint.background,
        color: paint.color,
        // A chosen toggle or option wears select's ring on its pill, never a seal (R15).
        ...(toggle?.selected || chosen ? SELECTED_RING : {}),
      }}
    >
      {model.kind.note && (
        <Badge shape="stamp" size="mini" className="su-entity-mini__kind" data-handback="">
          {model.kind.note}
        </Badge>
      )}
      {model.tier && <span className="su-entity-mini__tier">{model.tier}</span>}
      {/* The cut-out: the name on a tab of paper, in ink, notched into the pill
          from a thin strip of paint to its foot (a Compact's head, at Mini size). */}
      <span className="su-entity-mini__notch">
        {acts ? (
          // The name is the link and the Peek trigger (C8, R6): the controls
          // sit beside it in the chip group, never inside a link.
          surface(
            'su-entity-mini__name su-entity-mini__link',
            <>
              {title}
              <KindLabel kind={model.kind.type} />
            </>,
            peek
          )
        ) : (
          <span className="su-entity-mini__name">
            {title}
            <KindLabel kind={model.kind.type} />
          </span>
        )}
      </span>
      {hasChips && (
        <Chips
          as="span"
          className="su-entity-mini__chips"
          chips={set}
          size="mini"
          // A player made it: the HOMEBREW stamp leads its chips (ruleset §3.9).
          marks={userMade ? <HomebrewStamp /> : undefined}
          state={state}
          uses={slots.uses}
          menu={slots.menu}
        />
      )}
    </span>
  )
  const dimClass = dim ? SELECT_DIM : undefined
  // Header-only, the surface is the Mini; contentful, it is the head.
  const surfaceClass = body ? 'su-entity-mini__head' : cn('su-entity-mini', dimClass)
  // A Mini with controls: a plain frame, its name the link (above).
  if (acts && !body) {
    return (
      <div className={cn('su-entity-mini', dimClass)} data-acts="">
        {pill}
      </div>
    )
  }
  // A contentful Mini with controls (a sheet item in Edit): its head is a
  // plain frame too, its name the link, so no control sits inside a link.
  const head = acts ? (
    // Contentful with controls: the name inside is the link and the Peek
    // trigger, so the head is a plain frame around the pill.
    <div className={surfaceClass} data-acts="">
      {pill}
    </div>
  ) : (
    surface(surfaceClass, pill, peek)
  )
  if (!body) return head
  return (
    <div ref={contentfulRef} className={cn('su-entity-mini', dimClass)} data-contentful="">
      {head}
      {/* Bordered in the pill's subtle ink-40 (R38), so the Mini contains its content. */}
      <div
        data-user-made={userMade || undefined}
        className="su-entity-mini__body"
        style={down ? { opacity: 0.6 } : undefined}
      >
        {/* What of the head's chips does not fit beside the name: the body's
            first row (C2b, `chipFit.ts`). */}
        {hasChips && <ChipOverflowRow />}
        {body.text !== false && (
          <ProseOwnerContext.Provider value={model.ref?.id}>
            <MiniText model={model} chassisName={body.chassisName} />
          </ProseOwnerContext.Provider>
        )}
        {body.children}
      </div>
    </div>
  )
}
