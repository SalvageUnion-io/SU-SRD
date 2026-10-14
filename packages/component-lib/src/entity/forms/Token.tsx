import type { CSSProperties, ReactNode } from 'react'
import type { EntityInstance } from 'salvageunion-reference'
import { Stat } from '../../components/atoms/Stat'
import type { CardOuterProps } from '../../components/referenceEntity/card/CardOuter'
import { CardOuter } from '../../components/referenceEntity/card/CardOuter'
import { USER_MADE_TITLE } from '../../components/referenceEntity/card/cardChrome'
import { cn } from '../../utils/cn'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { actionTypeStamps } from '../parts/actionStamps'
import { CostBox } from '../parts/Chips'
import { KindLabel } from '../parts/KindLabel'
import { PAPER_NAME, paintFor } from '../parts/paint'
import { usePeekAttrs } from '../peekContext'
import type { EntityMode, EntityRowModel } from '../types'

/** One Token chip: `[TL | 2]`, `[4 ACTIONS]`. */
type TokenChip = { label: string; value?: string }

/**
 * The facts a Token keeps, by their chip label (owner's set, 2026-10-14): Tech
 * Level, the slots it takes or has, and its hit or structure points, a
 * player unit's live reading (`SP 7/9`) included. Everything else (SV, EP,
 * RNG, DMG, traits) is the Row's and the Page's.
 */
const TOKEN_FACTS: ReadonlySet<string> = new Set(['TL', 'Slots', 'SYS', 'MODS', 'SP', 'HP'])

/**
 * A Token's own chips, in order: an ability's tree and level, the kept facts,
 * then its one action's type or, with two or more, how many it has (its own
 * folded action counted). The cost box follows, drawn by the Token.
 */
function tokenChips(model: EntityRowModel): TokenChip[] {
  const chips: TokenChip[] = []
  if (model.tree) chips.push({ label: model.tree.name, value: model.tree.level })
  for (const fact of model.facts) {
    if (TOKEN_FACTS.has(fact.short)) chips.push({ label: fact.short, value: fact.value })
  }
  const actions = (model.actions?.length ?? 0) + (model.folded ? 1 : 0)
  if (actions > 1) {
    chips.push({ label: `${actions} Actions` })
  } else {
    for (const stamp of actionTypeStamps(model.actionType, model.mechActionType)) {
      chips.push({ label: stamp })
    }
  }
  if (chips.length === 0 && model.kind.classKind) chips.push({ label: model.kind.classKind })
  return chips
}

/** The adapter's resolved parts (`ReferenceEntityCard` `size="small" extent="head"`). */
export type TokenSlots = {
  outer?: CardOuterProps
  frameStyle?: CSSProperties
  /** The kind, for screen readers (`KindLabel`). */
  kind?: string
  /** The Dashboard's pennant button. */
  pennant?: ReactNode
  /** A read cost ("1 EP"), as its chip. */
  cost?: string
  down?: boolean
}

/*
 * The pill, its note stamp and its name are `.su-entity-token__*` classes
 * (`styles/index.css`), not style objects: a page lists tokens by the dozen,
 * so inline they repeated on every one (ADR-046, repeated elements). The
 * pill's paint and a caller's frame stay inline; a player-made pill's dashes
 * ride `data-user-made`.
 */

/**
 * TOKEN — the shortform (§3): `name [chips]`, one size, for many on a line or
 * a slot under 12rem (E3). Its chips are a short set (`tokenChips`), then the
 * cost box, the same in every context. It stays one
 * line: the chips never shrink, and only when they need the room does the
 * name end in "…" (E18). Its kind is never stamped (E9): screen readers
 * hear it after the name (`KindLabel`); a player unit's note ("Engineer")
 * leads in its place. A tone pill for a thing you have, the tier
 * tone or ink for a thing you do, dashed when player-made. It wraps as a
 * whole, never mid-token; in link mode it opens its entity. Hover, focus or a
 * long press Peeks it: the whole card, read-only (E16).
 */
export function Token({
  model,
  instance,
  mode = { kind: 'read' },
  slots = {},
}: {
  model: EntityRowModel
  instance?: EntityInstance
  mode?: EntityMode
  slots?: TokenSlots
}) {
  const target = useLinkTarget(mode, model.ref)
  const peek = usePeekAttrs(model.ref)
  const down =
    slots.down ?? (instance?.condition === 'damaged' || instance?.condition === 'destroyed')
  const paint = paintFor(model.tone, { down, texture: false })
  const userMade = !!(model.userMade || instance?.userMade)
  const title = instance?.title ?? model.title
  const chips = tokenChips(model)
  const cost = slots.cost ?? model.cost
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
        <span className={cn('su-entity-token__kind', paint.ink && 'su-entity-token__kind--on-ink')}>
          {model.kind.note}
        </span>
      )}
      <span className="su-entity-token__name">
        {paint.nameOnPaper ? <span style={PAPER_NAME}>{title}</span> : title}
        <KindLabel kind={slots.kind ?? model.kind.type} />
      </span>
      {slots.pennant}
      {(chips.length > 0 || cost) && (
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
          {cost && <CostBox cost={cost} rung="mini" onInk={paint.ink} />}
        </span>
      )}
    </span>
  )
  if (slots.outer) {
    return (
      <CardOuter
        {...slots.outer}
        className={`${slots.outer.className} su-entity-token`}
        peek={peek}
      >
        {pill}
      </CardOuter>
    )
  }
  return (
    <LinkSurface
      target={target}
      label={title}
      attrs={mode.kind === 'link' ? mode.attrs : undefined}
      peek={peek}
      className="su-entity-token"
    >
      {pill}
    </LinkSurface>
  )
}
