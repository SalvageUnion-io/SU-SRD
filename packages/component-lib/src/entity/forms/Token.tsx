import type { CSSProperties, ReactNode } from 'react'
import type { EntityInstance } from 'salvageunion-reference'
import type { CardOuterProps } from '../../components/referenceEntity/card/CardOuter'
import { CardOuter } from '../../components/referenceEntity/card/CardOuter'
import { USER_MADE_TITLE } from '../../components/referenceEntity/card/cardChrome'
import { Stat } from '../../components/shared/Stat'
import { font, fontSize, space, tracking, weight } from '../../design/tokens'
import { useEntitySurface } from '../entitySurfaceContext'
import { LinkSurface } from '../modes/link'
import { useLinkTarget } from '../modes/linkTarget'
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
  kind?: string
  fact?: TokenFact | null
  pennant?: ReactNode
  down?: boolean
}

const PILL: CSSProperties = {
  alignItems: 'center',
  alignSelf: 'flex-start',
  borderColor: 'var(--color-ink)',
  borderRadius: 'var(--radius-card)',
  borderWidth: 'var(--bw-chrome)',
  display: 'inline-flex',
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  gap: space[6],
  letterSpacing: tracking.capsTight,
  lineHeight: 1.2,
  maxWidth: '100%',
  overflow: 'hidden',
  padding: `3px ${space[6]} 3px ${space[4]}`,
  position: 'relative',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

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

/** The name wins: it wraps onto a second line rather than being clipped. */
const NAME: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflowWrap: 'break-word',
  whiteSpace: 'normal',
}

const kindStamp = (ink: boolean): CSSProperties => ({
  backgroundColor: 'var(--color-ink)',
  border: `var(--bw-hairline) solid ${ink ? 'var(--color-paper)' : 'var(--color-ink)'}`,
  color: 'var(--color-paper)',
  flex: 'none',
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsSnug,
  padding: `1px ${space[4]}`,
})

/**
 * TOKEN — the shortform (§3): `[kind] name [fact]`, one size, for many on a
 * line or a slot under 12rem (E3). A tone pill for a thing you have, the tier
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
  const surface = useEntitySurface()
  const target = useLinkTarget(mode, model.ref)
  const peek = usePeekAttrs(model.ref)
  const down =
    slots.down ?? (instance?.condition === 'damaged' || instance?.condition === 'destroyed')
  const paint = paintFor(model.tone, { down, texture: false })
  const userMade = !!(model.userMade || instance?.userMade || surface.userMade)
  const title = instance?.title ?? model.title
  const shown =
    slots.fact !== undefined ? slots.fact : fact !== undefined ? fact : defaultFact(model)
  const pill = (
    <span
      data-user-made={userMade || undefined}
      title={userMade ? USER_MADE_TITLE : undefined}
      style={{
        ...PILL,
        backgroundColor: paint.background,
        borderStyle: userMade ? 'dashed' : 'solid',
        color: paint.color,
        ...slots.frameStyle,
      }}
    >
      {userMade && <span style={VISUALLY_HIDDEN}>User-made </span>}
      <span style={kindStamp(paint.ink)}>{slots.kind ?? model.kind.type}</span>
      <span style={NAME}>
        {paint.nameOnPaper ? <span style={PAPER_NAME}>{title}</span> : title}
      </span>
      {slots.pennant}
      {shown && (
        <Stat orientation="horizontal" label={shown.label} value={shown.value} size="mini" />
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
