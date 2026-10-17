import type { CSSProperties, ReactNode } from 'react'
import type { EntityInstance, Fact } from 'salvageunion-reference'
import { splitStatLine } from 'salvageunion-reference'
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

/** One Token chip, label first: `[TL | 2]`, `[ACTIONS | 3]`. */
type TokenChip = { label: string; value?: string }

/**
 * The facts a Token keeps, by their chip label (owner's set, 2026-10-14): Tech
 * Level, the slots it takes or has, its hit or structure points, a player
 * unit's live reading (`SP 7/9`) included, and its range as the book's code
 * (`RNG | C`). Everything else (SV, EP, DMG, and traits) is the Row's and the
 * Page's, but a chassis keeps its chip set (the model's `entityStats`) less
 * its SYS and MODS (owner, 2026-10-14): TL, SV, SP, EP. A contentful Token
 * stands for the card it replaces, so its head keeps every action facet (DMG
 * too) and the traits (N3).
 */
const TOKEN_FACTS: ReadonlySet<string> = new Set(['TL', 'Slots', 'SYS', 'MODS', 'SP', 'HP', 'RNG'])

/** The chassis facts a Token drops: its slot capacities are the Row's and the Page's. */
const CHASSIS_DROPPED: ReadonlySet<string> = new Set(['SYS', 'MODS'])

/**
 * A Token's own chips, in the stat order (E17): the kept stats (TL first),
 * then its one action's type or, with two or more, how many it has
 * (`ACTIONS | 3`: the actions its Peek and Page list, its folded self-action
 * not among them, since that is the entity's own facts and cost), then the
 * action's kept facets (`RNG | C`; a contentful Token's are all of them,
 * `RNG | C`, `DMG | 2`) and a contentful Token's traits (`SHIELD`), as the
 * action card it stands for heads with (N3). The cost box
 * follows, drawn by the Token. An ability's tier is its numeral before the
 * name, never a chip.
 */
function tokenChips(
  model: EntityRowModel,
  omit: readonly EntityOmit[],
  contentful: boolean
): TokenChip[] {
  const chassis = model.ref.schemaName === 'chassis' && !model.ref.synthetic
  const kept = (facts: readonly Fact[], all = false): TokenChip[] =>
    facts
      .filter(
        (fact) => all || (chassis ? !CHASSIS_DROPPED.has(fact.short) : TOKEN_FACTS.has(fact.short))
      )
      .filter((fact) => !omit.includes(fact.key))
      .map((fact) => ({ label: fact.short, value: fact.shortValue ?? fact.value }))
  const { stats, action } = splitStatLine(model.facts)
  const chips: TokenChip[] = kept(stats)
  const actions = model.actions?.length ?? 0
  // A folded self-action's type is the entity's own; one listed action beside
  // it is still a count, or its type would read as the entity's.
  if (actions > 1 || (actions === 1 && model.folded)) {
    chips.push({ label: 'Actions', value: String(actions) })
  } else {
    for (const stamp of actionTypeStamps(model.actionType, model.mechActionType)) {
      chips.push({ label: stamp })
    }
  }
  chips.push(...kept(action, contentful))
  if (contentful) {
    for (const trait of model.traits) {
      chips.push({ label: trait.name, ...(trait.param ? { value: trait.param } : {}) })
    }
  }
  if (chips.length === 0 && model.kind.classKind) chips.push({ label: model.kind.classKind })
  return chips
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
 * a slot under 12rem (E3). Its chips are a short set (`tokenChips`), then the
 * cost box, the same in every context; an ability's tier numeral sits before
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
  instance,
  mode = READ,
  omit = [],
  slots = {},
  body,
}: {
  model: EntityRowModel
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
  const chips = tokenChips(model, omit, !!body)
  // The pennant reads the cost ("1 EP"): a chip beside it would repeat it.
  const cost = slots.pennant ? undefined : (slots.cost ?? model.cost)
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
      {(chips.length > 0 || cost || slots.trailing) && (
        <span className="su-entity-token__chips">
          {chips.map((chip) => (
            <Stat
              key={chip.label}
              orientation="horizontal"
              label={chip.label}
              value={chip.value}
              size="mini"
              inverse={paint.ink}
            />
          ))}
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
