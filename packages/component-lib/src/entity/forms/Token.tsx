import type { CSSProperties, ReactNode } from 'react'
import type { EntityInstance } from 'salvageunion-reference'
import { Stat } from '../../components/atoms/Stat'
import type { CardOuterProps } from '../../components/referenceEntity/card/CardOuter'
import { CardOuter } from '../../components/referenceEntity/card/CardOuter'
import { USER_MADE_TITLE } from '../../components/referenceEntity/card/cardChrome'
import { cn } from '../../utils/cn'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
import { CostBox } from '../parts/Chips'
import { KindLabel } from '../parts/KindLabel'
import { PAPER_NAME, paintFor } from '../parts/paint'
import { usePeekAttrs } from '../peekContext'
import type { EntityMode, EntityRowModel } from '../types'

/** The one fact a Token carries: `[TL | 2]`, `[LVL | 1]`, `[HP | 9]`. */
export type TokenFact = { label: string; value?: string }

/** The fact a context counts by default: tier, Tech Level, hit points, a class's kind. */
function defaultFact(model: EntityRowModel): TokenFact | undefined {
  if (model.tier) return { label: 'LVL', value: model.tier }
  if (model.techLevel != null) return { label: 'TL', value: String(model.techLevel) }
  const vital = model.facts.find((f) => f.short === 'HP' || f.short === 'SP')
  if (vital) return { label: vital.short, value: vital.value }
  return model.kind.classKind ? { label: model.kind.classKind } : undefined
}

/** The adapter's resolved parts (`ReferenceEntityCard` `size="small" extent="head"`). */
export type TokenSlots = {
  outer?: CardOuterProps
  frameStyle?: CSSProperties
  /** The kind, for screen readers (`KindLabel`). */
  kind?: string
  fact?: TokenFact | null
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

/** Read by assistive tech only: the dashes are the pill's only visual user-made cue. */
const VISUALLY_HIDDEN: CSSProperties = {
  border: 0,
  clip: 'rect(0, 0, 0, 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
}

/**
 * TOKEN — the shortform (§3): `name [fact]`, one size, for many on a line or
 * a slot under 12rem (E3). Its kind is never stamped (E9): screen readers
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
  fact,
  slots = {},
}: {
  model: EntityRowModel
  instance?: EntityInstance
  mode?: EntityMode
  /** The fact the context counts, in place of the default; `null` for none. */
  fact?: TokenFact | null
  slots?: TokenSlots
}) {
  const target = useLinkTarget(mode, model.ref)
  const peek = usePeekAttrs(model.ref)
  const down =
    slots.down ?? (instance?.condition === 'damaged' || instance?.condition === 'destroyed')
  const paint = paintFor(model.tone, { down, texture: false })
  const userMade = !!(model.userMade || instance?.userMade)
  const title = instance?.title ?? model.title
  const shown =
    slots.fact !== undefined ? slots.fact : fact !== undefined ? fact : defaultFact(model)
  const pill = (
    <span
      data-user-made={userMade || undefined}
      title={userMade ? USER_MADE_TITLE : undefined}
      className="su-entity-token__pill"
      style={{ backgroundColor: paint.background, color: paint.color, ...slots.frameStyle }}
    >
      {userMade && <span style={VISUALLY_HIDDEN}>User-made </span>}
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
      {shown && (
        <Stat orientation="horizontal" label={shown.label} value={shown.value} size="mini" />
      )}
      {slots.cost && <CostBox cost={slots.cost} rung="mini" onInk={paint.ink} />}
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
