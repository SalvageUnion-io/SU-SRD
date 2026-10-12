import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Badge } from '../../components/atoms/Badge'
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

/** The name and its labels: the row's room, the labels right after the name. */
const NAME: CSSProperties = {
  alignItems: 'center',
  columnGap: space[8],
  display: 'flex',
  flex: '1 1 0',
  minWidth: 0,
}

/**
 * Beside its labels the name gives way first, wrapping at spaces (a high
 * shrink), but keeps its longest word whole: only then do the labels give way.
 */
const NAME_TITLE: CSSProperties = {
  flex: '0 100 auto',
  minWidth: 'min-content',
  overflowWrap: 'break-word',
}

/** The labels give way once the name cannot wrap further, truncating with "…". */
const LABELS: CSSProperties = { display: 'flex', flex: '0 1 auto', minWidth: 0 }

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

/** The one line that never wraps: tier, name and labels, hint, stamps, pennant, affordance. */
const LINE: CSSProperties = {
  alignItems: 'center',
  columnGap: space[8],
  display: 'flex',
  flex: '1 1 auto',
  flexWrap: 'nowrap',
  minWidth: 0,
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
  /** The labels (`CardLabels`): on the name's line, right after the name. */
  labels?: ReactNode
}

/**
 * HEAD — a Row's band: one line that never wraps: the tier, the name (two
 * lines, then clamped) with its labels to its right, a hint, the action-type stamp (E17), the condition,
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
  labels,
}: HeadProps) {
  const ink = { color: paint.color }
  return (
    <div
      className="su-entity-row__head"
      data-fill={paint.ink ? 'ink' : 'tone'}
      data-grain={paint.grain}
      style={{
        ...grainStyle(paint.grain),
        backgroundColor: paint.background,
        color: paint.color,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        padding: `${space[6]} ${space[10]}`,
      }}
    >
      <div className="su-entity-row__line" style={LINE}>
        {tier && (
          <span style={{ ...TITLE, display: 'inline', flex: 'none', opacity: 0.75 }}>{tier}</span>
        )}
        <div style={NAME}>
          {titleSlot ?? (
            <TitleTag
              className="su-entity-row__title"
              title={title}
              style={{ ...TITLE, ...ink, ...NAME_TITLE }}
            >
              {paint.nameOnPaper ? <span style={PAPER_NAME}>{title}</span> : title}
            </TitleTag>
          )}
          {labels && <div style={LABELS}>{labels}</div>}
        </div>
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
    </div>
  )
}
