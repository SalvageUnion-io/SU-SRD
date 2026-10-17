import type { CSSProperties, ReactNode } from 'react'
import type { ChipContext, EntityInstance, TokenChips } from 'salvageunion-reference'
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
import { actionTypeStamps } from '../parts/actionStamps'
import { CostBox } from '../parts/Chips'
import { KindLabel } from '../parts/KindLabel'
import { paintFor } from '../parts/paint'
import { useInsidePeek, usePeekAttrs } from '../peekContext'
import type { EntityMode, EntityOmit, EntityRowModel } from '../types'

/**
 * A Token's chips (`chips-and-actions.md`, C3 and C4): the model's
 * `tokenChips` for the context its container names, drawn as Mini cells in
 * the class order — the rank, the context lane (an action type as its
 * stamps), and a contentful Token's economy, facets and traits (N3). The cost box and
 * the host's state chip follow.
 */
function TokenCells({ chips, onInk }: { chips: TokenChips; onInk: boolean }) {
  const cells: { label: string; value?: string }[] = []
  if (chips.rank) cells.push(chips.rank)
  for (const lane of [chips.lane, chips.economy]) {
    if (lane?.kind === 'cell') cells.push(lane.cell)
    if (lane?.kind === 'actionType') {
      for (const stamp of actionTypeStamps(lane.actionType, lane.mechActionType)) {
        cells.push({ label: stamp })
      }
    }
  }
  cells.push(...(chips.facets ?? []), ...(chips.traits ?? []))
  return cells.map((cell) => (
    <Stat
      key={cell.label}
      orientation="horizontal"
      label={cell.label}
      value={cell.value}
      size="mini"
      inverse={onInk}
    />
  ))
}

/** The adapter's resolved parts (`ReferenceEntityCard` `extent="head"`, any size: N2). */
export type TokenSlots = {
  outer?: CardOuterProps
  /** Peek this address in place of the entity's own (`embeddedPeekAddress`). */
  peekAt?: string
  frameStyle?: CSSProperties
  /** The kind, for screen readers (`KindLabel`). */
  kind?: string
  /** The Dashboard's pennant button. It carries the cost, so the Token draws no cost chip beside it. */
  pennant?: ReactNode
  /** A read cost ("1 EP"), as its chip. */
  cost?: string
  down?: Down
  /** The host's chip, last in the chip group after the cost box (a damaged thing's condition). */
  trailing?: ReactNode
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
  // The pennant reads the cost ("1 EP"): a chip beside it would repeat it.
  const cost = slots.pennant ? undefined : (slots.cost ?? chips.cost)
  const hasCells = !!(chips.rank || chips.lane || chips.economy || chips.facets || chips.traits)
  const pill = (
    <span
      data-user-made={userMade || undefined}
      title={userMade ? USER_MADE_TITLE : undefined}
      className="su-entity-token__pill"
      style={{ backgroundColor: paint.background, color: paint.color, ...slots.frameStyle }}
    >
      {/* Read by assistive tech only: the dashes are the pill's only visual user-made cue. */}
      {userMade && <span className="su-sr-only">User-made </span>}
      {model.kind.note && (
        <Badge
          shape="stamp"
          size="mini"
          className={cn('su-entity-token__kind', paint.ink && 'su-entity-token__kind--on-ink')}
        >
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
      {slots.pennant}
      {(hasCells || cost || slots.trailing) && (
        <span className="su-entity-token__chips">
          <TokenCells chips={chips} onInk={paint.ink} />
          {cost && <CostBox cost={cost} size="mini" onInk={paint.ink} />}
          {slots.trailing}
        </span>
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
