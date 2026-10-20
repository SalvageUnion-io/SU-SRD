import type { CSSProperties, ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'
import type { ChipContext, EntityInstance } from 'salvageunion-reference'
import { tokenChips } from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { capsLabel } from '../../atoms/capsLabel'
import { FOCUS_RING } from '../../atoms/interaction'
import { Stat } from '../../atoms/Stat'
import { Content } from '../../referenceEntity/Content'
import type { CardOuterProps } from '../../referenceEntity/card/CardOuter'
import { CardOuter } from '../../referenceEntity/card/CardOuter'
import type { Down } from '../../referenceEntity/card/cardChrome'
import { downOf, USER_MADE_TITLE } from '../../referenceEntity/card/cardChrome'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { SELECT_DIM, SELECTED_RING } from '../modes/selectedRing'
import { toggleAttrs } from '../modes/toggle'
import { Chips } from '../parts/Chips'
import { watchMore } from '../parts/chipFit'
import { chipCount } from '../parts/chipSet'
import { KindLabel } from '../parts/KindLabel'
import { paintFor } from '../parts/paint'
import type { TagItem } from '../parts/tagItems'
import { tokenChipSet } from '../parts/tokenChipSet'
import type { PeekAttrs } from '../peekContext'
import { PEEK_ATTRIBUTE, useInsidePeek, usePeekAttrs } from '../peekContext'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

/** The pill sets its name and chips in the caps recipe. */
const PILL = cn('su-entity-token__pill', capsLabel())

/** The adapter's resolved parts (`ReferenceEntityCard` `extent="head"`, any size: N2). */
export type TokenSlots = {
  outer?: CardOuterProps
  /** Peek this address in place of the entity's own (`embeddedPeekAddress`). */
  peekAt?: string
  frameStyle?: CSSProperties
  /** The kind, for screen readers (`KindLabel`). */
  kind?: string
  /** A read cost ("1 EP"), as its chip. */
  cost?: string
  /**
   * What it is linked to, as relation chips before the cost (C11): a crewmate's
   * `MECH | Scrapper`. Where its host names it (Play's Crew, R5), never a stamp.
   */
  relations?: TagItem[]
  down?: Down
  /** The host's state chip, after the cost box (C8): a damaged thing's condition, a reading. */
  state?: ReactNode
  /** The uses slot after the state (C8): a live sheet item's `USES | 3/5` stepper. */
  uses?: ReactNode
  /**
   * The last slot (C8): the host's actions and its ✕, at the Token's Size.
   * A Token with controls (this or `uses`) is a `div` whose NAME is the link
   * and the Peek trigger, so no control sits inside a link
   * (`chips-and-actions.md`, "A Token with actions").
   */
  menu?: ReactNode
}

/**
 * A CONTENTFUL Token's body (N3): what it draws under its one-row head,
 * bordered in its tone, with no band. A Token without one is its head alone.
 */
export type TokenBody = {
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
   * facts and, in Edit, their fields. Never an entity (a Token nests
   * nothing, E6), and inside a Peek read-only (E16).
   */
  children?: ReactNode
}

const READ: EntityMode = { kind: 'read' }

/** The text under a contentful Token's head: the model's prose, else its lead. */
function TokenText({ model, chassisName }: { model: EntityRowModel; chassisName?: string }) {
  if (model.prose?.length) return <Content body={model.prose} chassisName={chassisName} />
  return model.lead ? <p className="su-entity-token__lead">{model.lead}</p> : null
}

/**
 * A contentful Token's +MORE (C5): drawn once its chips would take more than
 * two lines (`chipFit.ts`), at the end of the second; until then, and on a
 * page with no script, it is hidden and every chip wraps. It is a Peek
 * trigger of the Token's own address, a button beside the head's link, never
 * inside it: hover, focus, a long press or a press opens the Token's Peek.
 */
function MoreChip({ title, peek }: { title: string; peek: PeekAttrs }) {
  return (
    <span className="su-entity-token__more" hidden>
      <Button
        size="mini"
        className="su-chip-more"
        aria-label={`More, opens ${title}`}
        {...peek}
        // A press opens it too (`PEEK_PRESS_ATTRIBUTE`): it has nowhere else to go.
        data-peek-press=""
      >
        +MORE
      </Button>
    </span>
  )
}

type ToggleMode = Extract<EntityMode, { kind: 'select' }>

/** The toggle Token's surface (`toggleAttrs`): where the link would stand, pressed while chosen. */
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
 * The pill, its note stamp and its name are `.su-entity-token__*` classes
 * (`styles/index.css`), not style objects: a page lists tokens by the dozen,
 * so inline they repeated on every one (ADR-046, repeated elements). The
 * pill's paint and a caller's frame stay inline; a player-made pill's dashes
 * ride `data-user-made`.
 */

/**
 * TOKEN — the shortform (§3): `name [chips]`, one size, at level 2 (E6) or in
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
 * In select mode it is the TOGGLE Token (EDL Modes, `role: 'toggle'`): its
 * surface (or, with controls, its name) is pressed while chosen, the ring on
 * its pill, never a seal; a radio or checkbox select stays a Row's (N7).
 * `dim` is its host's one dim (`SELECT_DIM`): an unchosen toggle beside a
 * chosen one, a Play action not on hand.
 */
export function Token({
  model,
  context,
  instance,
  mode = READ,
  omit = [],
  slots = {},
  body,
  dim = false,
}: {
  model: EntityRowModel
  /** Where it is drawn (C4): picks the one fact its context lane carries. */
  context: ChipContext
  instance?: EntityInstance
  mode?: EntityMode
  /** Facts the context already states, by key (`tech-level`), left off its chips. */
  omit?: readonly EntityOmit[]
  slots?: TokenSlots
  /** N3: the text and the host's content under the head; without it the Token is its head alone. */
  body?: TokenBody
  /** Its host's one dim (`SELECT_DIM`): unchosen beside a chosen toggle, not on hand. */
  dim?: boolean
}) {
  const contentfulRef = useRef<HTMLDivElement>(null)
  // Every commit: the chips may have changed (C5's fit starts from them all).
  useLayoutEffect(() => {
    const token = contentfulRef.current
    return token ? watchMore(token) : undefined
  })
  const insidePeek = useInsidePeek()
  // A contentful Token in a Peek reads (E16): its head opens nothing.
  const headMode = body && insidePeek ? READ : mode
  const toggle = headMode.kind === 'select' && headMode.role === 'toggle' ? headMode : null
  const target = useLinkTarget(headMode, model.ref)
  const down = slots.down ?? downOf(instance?.condition)
  const peek = usePeekAttrs(model.ref, slots.peekAt, down)
  const paint = paintFor(model.tone, { down, texture: false })
  const userMade = !!(model.userMade || instance?.userMade)
  const title = instance?.title ?? model.title
  const chips = tokenChips(model, context, {
    omit,
    contentful: !!body,
    ...(instance?.count !== undefined ? { count: instance.count } : {}),
  })
  const cost = slots.cost ?? chips.cost
  const own = tokenChipSet(chips, cost)
  const quantity = own.quantity
  const set = slots.relations?.length ? { ...own.set, relations: slots.relations } : own.set
  const state = [
    quantity && <Stat key="quantity" label={quantity.label} value={quantity.value} size="mini" />,
    slots.state,
  ]
  // A relation that Peeks or opens is a control of its own: the name is then
  // the link, so it never nests in one (C11).
  const linkedRelation = !!slots.relations?.some((r) => r.ref || r.href)
  const acts = slots.uses !== undefined || slots.menu !== undefined || linkedRelation
  const hasChips = chipCount(set) > 0 || !!quantity || !!slots.state || acts
  // C5: a contentful Token's chips past two lines end in +MORE, which opens
  // its Peek; with no Peek (inside one, E16) every chip wraps. Its slot is the
  // end of the menu lane: after a sheet item's own controls (C8), the last.
  const more = !!body && hasChips && !!peek['data-peek']
  const moreSlot = more ? <span className="su-chip-more-slot" aria-hidden="true" hidden /> : null
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
        ...slots.frameStyle,
        // A chosen toggle wears select's ring on its pill, never a seal (R15).
        ...(toggle?.selected ? SELECTED_RING : {}),
      }}
    >
      {/* Read by assistive tech only: the dashes are the pill's only visual user-made cue. */}
      {userMade && <span className="su-sr-only">User-made </span>}
      {model.kind.note && (
        <Badge shape="stamp" size="mini" className="su-entity-token__kind" data-handback="">
          {model.kind.note}
        </Badge>
      )}
      {model.tier && <span className="su-entity-token__tier">{model.tier}</span>}
      {/* The cut-out: the name on a tab of paper, in ink, notched into the pill
          from a thin strip of paint to its foot (a Row's head, at Token size). */}
      <span className="su-entity-token__notch">
        {acts ? (
          // The name is the link and the Peek trigger (C8, R6): the controls
          // sit beside it in the chip group, never inside a link.
          surface(
            'su-entity-token__name su-entity-token__link',
            <>
              {title}
              <KindLabel kind={slots.kind ?? model.kind.type} />
            </>,
            peek
          )
        ) : (
          <span className="su-entity-token__name">
            {title}
            <KindLabel kind={slots.kind ?? model.kind.type} />
          </span>
        )}
      </span>
      {hasChips && (
        <Chips
          as="span"
          className="su-entity-token__chips"
          chips={set}
          size="mini"
          state={state}
          uses={slots.uses}
          menu={
            slots.menu !== undefined && moreSlot ? (
              <>
                {slots.menu}
                {moreSlot}
              </>
            ) : (
              (slots.menu ?? moreSlot ?? undefined)
            )
          }
        />
      )}
    </span>
  )
  const dimClass = dim ? SELECT_DIM : undefined
  // Header-only, the surface is the Token; contentful, it is the head. A head
  // that acts (a link, a toggle, or a Peek's long press) takes the coarse
  // pointer's 44px hit area, as the header-only Token does (ruleset §4.6).
  const headActs = (!slots.outer && (!!target.href || !!toggle)) || PEEK_ATTRIBUTE in peek
  const surfaceClass = body
    ? cn('su-entity-token__head', headActs && !acts && 'su-hit-area')
    : cn('su-entity-token', dimClass)
  // A Token with controls: a plain frame, its name the link (above).
  if (acts && !slots.outer && !body) {
    return (
      <div className={cn('su-entity-token', dimClass)} data-acts="">
        {pill}
      </div>
    )
  }
  // A contentful Token with controls (a sheet item in Edit): its head is a
  // plain frame too, its name the link, so no control sits inside a link.
  const head = slots.outer ? (
    <CardOuter {...slots.outer} className={cn(slots.outer.className, surfaceClass)} peek={peek}>
      {pill}
    </CardOuter>
  ) : acts ? (
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
    <div ref={contentfulRef} className={cn('su-entity-token', dimClass)} data-contentful="">
      {head}
      {more && <MoreChip title={title} peek={peek} />}
      {/* Bordered in the pill's own tone, so the Token contains its content. */}
      <div
        data-user-made={userMade || undefined}
        className="su-entity-token__body"
        style={{ borderColor: paint.background, ...(down && { opacity: 0.6 }) }}
      >
        {body.text !== false && <TokenText model={model} chassisName={body.chassisName} />}
        {body.children}
      </div>
    </div>
  )
}
