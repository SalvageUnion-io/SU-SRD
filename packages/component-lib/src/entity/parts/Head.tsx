import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Badge } from '../../components/atoms/Badge'
import { grainClass } from '../../components/referenceEntity/card/cardGrain'
import { font } from '../../design/tokens'
import { cn } from '../../utils/cn'
import type { Paint } from './paint'
import { PAPER_NAME } from './paint'

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

/*
 * The band's parts are `.su-entity-row__*` classes (`styles/index.css`), not
 * style objects: a listing repeats them on every row, so inline they were a
 * large share of each page (ADR-046, repeated elements). What varies by row
 * (the paint) stays inline.
 */

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
  /**
   * The cut-out (ruleset, "Chapter band"): the tier and name notched into the
   * band's foot on a tab of the paper below, in ink, as a catalog Tile's. For
   * a head with a paper body under it (a bodied Row, a pattern row).
   */
  notch?: boolean
}

/**
 * HEAD — a Row's band: one line that never wraps: the tier, the name (it
 * wraps, never clipped; with `notch`, both on the paper cut-out at the band's
 * foot) with its labels to its right, a hint, the action-type stamp (E17), the condition,
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
  notch = false,
}: HeadProps) {
  const tierNode = tier && <span className="su-entity-row__tier">{tier}</span>
  const titleNode = titleSlot ?? (
    <TitleTag
      className="su-entity-row__title"
      title={title}
      // On the notch's paper the name is ink (the class's), whatever the band.
      style={notch ? undefined : { color: paint.color }}
    >
      {paint.nameOnPaper && !notch ? <span style={PAPER_NAME}>{title}</span> : title}
    </TitleTag>
  )
  return (
    <div
      className={cn('su-entity-row__head', grainClass(paint.grain))}
      data-fill={paint.ink ? 'ink' : 'tone'}
      data-grain={paint.grain}
      data-notch={notch || undefined}
      style={{ backgroundColor: paint.background, color: paint.color }}
    >
      <div className="su-entity-row__line">
        {notch ? null : tierNode}
        <div className="su-entity-row__name">
          {notch ? (
            <span className="su-entity-row__notch">
              {tierNode}
              {titleNode}
            </span>
          ) : (
            titleNode
          )}
          {labels && <div className="su-entity-row__labels">{labels}</div>}
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
