import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Badge } from '../../components/chrome/Badge'
import { grainStyle } from '../../components/referenceEntity/card/cardGrain'
import { font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Paint } from './paint'
import { PAPER_NAME } from './paint'

/** The title: the row's room, two lines, then "…" (its full name in a tooltip). */
const TITLE: CSSProperties = {
  display: '-webkit-box',
  flex: '1 1 0',
  fontFamily: font.cond,
  fontSize: fontSize.title,
  fontWeight: weight.extrabold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.05,
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  textTransform: 'uppercase',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
}

/** A one-line hint on the band (a pattern row's description), truncated. */
const HINT: CSSProperties = {
  contain: 'inline-size',
  flex: '1 1 0',
  fontFamily: font.body,
  fontStyle: 'italic',
  minWidth: 0,
  overflow: 'hidden',
  textAlign: 'right',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export type HeadProps = {
  title: string
  titleAs?: ElementType
  /** A full replacement for the title node (a legacy `titleSlot`). */
  titleSlot?: ReactNode
  paint: Paint
  /** An ability's tier numeral, at the left. */
  tier?: string
  /** The action-type stamps (E17), before the condition and the pennant. */
  stamps?: string[]
  /** The instance's condition stamp (the Hold mode's slot). */
  condition?: ReactNode
  /** A one-line hint, after the title. */
  hint?: ReactNode
  /** The cost pennant (read) or the pennant button (act). */
  pennant?: ReactNode
  /** The mode's affordance: the link chevron, the "Selected" seal. */
  affordance?: ReactNode
  /** A stamp rides the seam above, so the band leaves it room. */
  seamed?: boolean
}

/**
 * HEAD — a Row's band, one line that never wraps: the tier, the name (two
 * lines, then clamped), a hint, the action-type stamp (E17), the condition,
 * the cost pennant and the mode's affordance, in that order. The band wears
 * the paint (`paintFor`): the tone or ink, grey when down.
 */
export function Head({
  title,
  titleAs: TitleTag = 'span',
  titleSlot,
  paint,
  tier,
  stamps = [],
  condition,
  hint,
  pennant,
  affordance,
  seamed = false,
}: HeadProps) {
  const ink = { color: paint.color }
  return (
    <div
      className="su-entity-row__head"
      data-fill={paint.ink ? 'ink' : 'tone'}
      data-grain={paint.grain}
      style={{
        ...grainStyle(paint.grain),
        alignItems: 'center',
        backgroundColor: paint.background,
        color: paint.color,
        columnGap: space[8],
        display: 'flex',
        flexWrap: 'nowrap',
        minWidth: 0,
        padding: seamed
          ? `${space[14]} ${space[10]} ${space[8]}`
          : `${space[6]} ${space[10]} ${space[6]}`,
      }}
    >
      {tier && (
        <span style={{ ...TITLE, display: 'inline', flex: 'none', opacity: 0.75 }}>{tier}</span>
      )}
      {titleSlot ?? (
        <TitleTag className="su-entity-row__title" title={title} style={{ ...TITLE, ...ink }}>
          {paint.nameOnPaper ? <span style={PAPER_NAME}>{title}</span> : title}
        </TitleTag>
      )}
      {hint && <span style={HINT}>{hint}</span>}
      {stamps.map((stamp) => (
        <Badge
          key={stamp}
          shape="stamp"
          size="mini"
          surface={paint.ink ? 'inverse' : 'on-ink'}
          style={{ flex: 'none', whiteSpace: 'nowrap' }}
        >
          {stamp}
        </Badge>
      ))}
      {condition}
      {pennant && <span style={{ display: 'flex', flex: 'none' }}>{pennant}</span>}
      {affordance}
    </div>
  )
}
