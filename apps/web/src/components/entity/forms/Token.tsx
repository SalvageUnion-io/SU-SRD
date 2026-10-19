import type { CSSProperties, ReactNode } from 'react'
import type { ChipContext, EntityInstance } from 'salvageunion-reference'
import { tokenChips } from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import { Badge } from '../../atoms/Badge'
import { Stat } from '../../atoms/Stat'
import { Content } from '../../referenceEntity/Content'
import type { CardOuterProps } from '../../referenceEntity/card/CardOuter'
import { CardOuter } from '../../referenceEntity/card/CardOuter'
import type { Down } from '../../referenceEntity/card/cardChrome'
import { downOf, USER_MADE_TITLE } from '../../referenceEntity/card/cardChrome'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { Chips } from '../parts/Chips'
import { chipCount } from '../parts/chipSet'
import { KindLabel } from '../parts/KindLabel'
import { paintFor } from '../parts/paint'
import { tokenChipSet } from '../parts/tokenChipSet'
import { useInsidePeek, usePeekAttrs } from '../peekContext'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

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
  down?: Down
  /** The host's state chip, after the cost box (C8): a damaged thing's condition, a reading. */
  state?: ReactNode
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
 * its name, as on its band. Its head is always one row (E18): the chips take
 * at most 65% of it, dropping whole from the end until they fit, and the name
 * takes the rest, ending in "…" when that is too little. Its kind is never
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
 */
export function Token({
  model,
  context,
  instance,
  mode = READ,
  omit = [],
  slots = {},
  body,
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
}) {
  const insidePeek = useInsidePeek()
  // A contentful Token in a Peek reads (E16): its head opens nothing.
  const headMode = body && insidePeek ? READ : mode
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
  const { set, quantity } = tokenChipSet(chips, cost)
  const state = [
    quantity && (
      <Stat
        key="quantity"
        orientation="horizontal"
        label={quantity.label}
        value={quantity.value}
        size="mini"
      />
    ),
    slots.state,
  ]
  const hasChips = chipCount(set) > 0 || !!quantity || !!slots.state
  const pill = (
    <span
      // The pill is the frame: on an ink pill (a thing you do) its cells,
      // stamp and cost box read the ground in CSS (chrome K1).
      data-ground={paint.ink ? 'ink' : undefined}
      data-user-made={userMade || undefined}
      title={userMade ? USER_MADE_TITLE : undefined}
      className="su-entity-token__pill"
      style={{ backgroundColor: paint.background, color: paint.color, ...slots.frameStyle }}
    >
      {/* Read by assistive tech only: the dashes are the pill's only visual user-made cue. */}
      {userMade && <span className="su-sr-only">User-made </span>}
      {model.kind.note && (
        <Badge shape="stamp" size="mini" className="su-entity-token__kind">
          {model.kind.note}
        </Badge>
      )}
      {model.tier && <span className="su-entity-token__tier">{model.tier}</span>}
      {/* The cut-out: the name on a tab of paper, in ink, notched into the pill
          from a thin strip of paint to its foot (a Row's head, at Token size). */}
      <span className="su-entity-token__notch">
        <span className="su-entity-token__name">
          {title}
          <KindLabel kind={slots.kind ?? model.kind.type} />
        </span>
      </span>
      {hasChips && (
        <Chips
          as="span"
          className="su-entity-token__chips"
          chips={set}
          size="mini"
          state={state}
          lanes
        />
      )}
    </span>
  )
  // Header-only, the surface is the Token; contentful, it is the head.
  const surfaceClass = body ? 'su-entity-token__head' : 'su-entity-token'
  const head = slots.outer ? (
    <CardOuter {...slots.outer} className={cn(slots.outer.className, surfaceClass)} peek={peek}>
      {pill}
    </CardOuter>
  ) : (
    <LinkSurface
      target={target}
      label={title}
      attrs={headMode.kind === 'link' ? headMode.attrs : undefined}
      peek={peek}
      className={surfaceClass}
    >
      {pill}
    </LinkSurface>
  )
  if (!body) return head
  return (
    <div className="su-entity-token" data-contentful="">
      {head}
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
