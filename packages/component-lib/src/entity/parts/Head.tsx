import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useRef } from 'react'
import { grainClass } from '../../components/referenceEntity/card/cardGrain'
import { font } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { KindLabel } from './KindLabel'
import type { Paint } from './paint'
import { PAPER_NAME } from './paint'
import { useChipsFit } from './useChipsFit'

/** A one-line hint on the band (a pattern row's description), truncated. */
const HINT = {
  contain: 'inline-size',
  flex: '1 1 0',
  fontFamily: font.body,
  fontStyle: 'italic',
  minWidth: 0,
  overflow: 'hidden',
  textAlign: 'right',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

/*
 * The band's parts are `.su-entity-row__*` classes (`styles/index.css`), not
 * style objects: a listing repeats them on every row, so inline they were a
 * large share of each page (ADR-046, repeated elements). What varies by row
 * (the paint) stays inline.
 */

export type HeadProps = {
  title: string
  /**
   * What the name's place shows in place of the `title` text: a live sheet's
   * inline-edit field (a crew lead's name). `title` still names the head.
   */
  titleContent?: ReactNode
  /** The entity's kind, for screen readers only (`KindLabel`): never a stamp (E9). */
  kind?: string
  titleAs?: ElementType
  paint: Paint
  /** An ability's tier numeral, at the left. */
  tier?: string
  /** The entity's chip group (`Chips`, E17): right of the name, or under it. */
  chips?: ReactNode
  /** A one-line hint, after the title. */
  hint?: ReactNode
  /** The pennant button (act): the Dashboard's. A read cost is a chip. */
  pennant?: ReactNode
  /** The mode's affordance: the "Selected" seal, a toggle's check. */
  affordance?: ReactNode
  /** The host's controls, the trailing slot after the affordance. */
  controls?: ReactNode
  /** The labels (`CardLabels`): on the name's line, right after the name. */
  labels?: ReactNode
  /**
   * The cut-out (ruleset, "Chapter band"): the name notched into the band's
   * foot on a tab of the paper below, in ink, as a catalog Tile's; the tier
   * stays on the band, left of it. Without `chipsBeside` it holds only for a
   * head with no chips: chips that drop under the name would leave the tab
   * mid-band.
   */
  notch?: boolean
  /**
   * Keep the cut-out with chips: the chips stay on the band right of the
   * name, and on a phone flow under it onto the paper when they do not fit
   * beside it (`useChipsFit`), never above it (every Row and Card head).
   */
  chipsBeside?: boolean
}

/**
 * HEAD — a Row's band: the tier (on the band), the name (it wraps, never
 * clipped; with `notch`, on the paper cut-out at the band's foot) with its labels to its
 * right, the chip group (right of the name while it fits, under it when it
 * does not: the band's own width decides), a hint, the pennant
 * button and the mode's affordance, in that order; the affordance stays on
 * the band's right, centred on it, never alone on a line. The band wears the
 * paint (`paintFor`): the tone or ink, grey when down.
 */
export function Head({
  title,
  titleContent,
  kind,
  titleAs: TitleTag = 'span',
  paint,
  tier,
  chips,
  hint,
  pennant,
  affordance,
  controls,
  labels,
  notch = false,
  chipsBeside = false,
}: HeadProps) {
  const cut = notch && (!chips || chipsBeside)
  const headingRef = useRef<HTMLDivElement>(null)
  useChipsFit(headingRef, cut && !!chips)
  const tierNode = tier && <span className="su-entity-row__tier">{tier}</span>
  const titleNode = (
    <TitleTag
      className="su-entity-row__title"
      title={title}
      // On the notch's paper the name is ink (the class's), whatever the band.
      style={cut ? undefined : { color: paint.color }}
    >
      {paint.nameOnPaper && !cut ? (
        <span style={PAPER_NAME}>{titleContent ?? title}</span>
      ) : (
        <span>{titleContent ?? title}</span>
      )}
      <KindLabel kind={kind} />
    </TitleTag>
  )
  // A cut-out head with chips keeps its labels (a type stamp: "Chassis
  // Ability") in the chip group, one right-floated group in one chip style,
  // never a stamp of its own beside the tab.
  const labelsWithChips = cut && !!chips && !!labels
  const labelsNode = labels && <div className="su-entity-row__labels">{labels}</div>
  const name = (
    <div className="su-entity-row__name">
      {cut ? <span className="su-entity-row__notch">{titleNode}</span> : titleNode}
      {!labelsWithChips && labelsNode}
    </div>
  )
  return (
    <div
      className={cn('su-entity-row__head', grainClass(paint.grain))}
      data-fill={paint.ink ? 'ink' : 'tone'}
      data-grain={paint.grain}
      data-notch={cut || undefined}
      style={{ backgroundColor: paint.background, color: paint.color }}
    >
      <div className="su-entity-row__line">
        {tierNode}
        {chips ? (
          <div
            ref={headingRef}
            className={cn('su-entity-row__heading', cut && 'su-entity-row__heading--cut')}
          >
            {name}
            {labelsWithChips ? (
              <div className="su-entity-row__chip-group">
                {labelsNode}
                {chips}
              </div>
            ) : (
              chips
            )}
          </div>
        ) : (
          name
        )}
        {hint && (
          <span className="su-entity-row__hint" style={HINT}>
            {hint}
          </span>
        )}
        {pennant && <span style={{ display: 'flex', flex: 'none' }}>{pennant}</span>}
        {affordance}
        {controls && <div className="su-entity-row__controls">{controls}</div>}
      </div>
    </div>
  )
}
