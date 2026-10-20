import type { ElementType, ReactNode } from 'react'
import { cloneElement, isValidElement, useRef } from 'react'
import { cn } from '../../../lib/cn'
import { capsLabel } from '../../atoms/capsLabel'
import { grainClass } from '../../referenceEntity/card/cardGrain'
import { Chips } from './Chips'
import type { ChipSet } from './chipSet'
import { KindLabel } from './KindLabel'
import type { Paint } from './paint'
import { PAPER_NAME } from './paint'
import { useChipsFit } from './useChipsFit'

/** The tier and the name: caps from the recipe, their extrabold weight the rule's. */
const NAME_CAPS = capsLabel({ weight: 'inherit' })

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
  /**
   * Draw the tier as a step's number chip: paper on an ink plate, butted
   * against the cut-out (`1 | FILL OUT YOUR STATS`), as a guide step's slab.
   */
  tierChip?: boolean
  /**
   * The entity's chip group (`Chips`, E17): right of the name, or under it.
   * Anything else a host passes is drawn by `Chips` as its marks (C2a).
   */
  chips?: ReactNode
  /**
   * The entity's art (`Art`, E10): its own paper window at the band's left,
   * the band on all four sides of it, centred on the row: apart from the name's cut-out.
   */
  art?: ReactNode
  /** The mode's affordance: the "Selected" seal, a toggle's check. */
  affordance?: ReactNode
  /**
   * The host's actions (Use, Roll, Sheet ⤢, Assign, a dialog's ✕): inlined in
   * the chip group after the cost, its last slot (`chips-and-actions.md` C8),
   * before any "⋯" the strip already ends with. Never beside the strip.
   */
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
   * name, stacking up the band on as many lines as they take, and rise over
   * it onto the band's full width only when one chip does not fit beside it
   * (`useChipsFit`), never under it (every Row and Card head).
   */
  chipsBeside?: boolean
  /**
   * A row of controls on the band above the name's line, the width of the
   * band: a dialog's search and filters (the SRD Explorer's), so they sit in
   * the head, as an index's sit on its chapter band.
   */
  top?: ReactNode
}

/**
 * HEAD — a Row's band: the art (its own window, at the left), the tier (on the band), the name (it wraps, never
 * clipped; with `notch`, on the paper cut-out at the band's foot) with its labels to its
 * right, the chip group (right of the name while it fits, under it when it
 * does not: the band's own width decides), the host's controls its last
 * slot, so nothing sits beside the strip (C8, R6), and the mode's affordance, in
 * that order; the affordance stays on the band's right, centred on it, never
 * alone on a line. The band wears the
 * paint (`paintFor`): the tone or ink, grey when down.
 */
export function Head({
  title,
  titleContent,
  kind,
  titleAs: TitleTag = 'span',
  paint,
  tier,
  tierChip = false,
  chips: chipsProp,
  art,
  affordance,
  controls,
  labels,
  notch = false,
  chipsBeside = false,
  top,
}: HeadProps) {
  const chips = asStrip(chipsProp, controls)
  const cut = notch && (!chips || chipsBeside)
  const headingRef = useRef<HTMLDivElement>(null)
  useChipsFit(headingRef, cut && !!chips)
  const tierNode = tier && (
    <span
      className={cn('su-entity-row__tier', NAME_CAPS, tierChip && 'su-entity-row__tier--chip')}
      data-handback=""
    >
      {tier}
    </span>
  )
  const titleNode = (
    <TitleTag
      className={cn('su-entity-row__title', NAME_CAPS)}
      // The app's heading face and print sizes hand the title its own back
      // (`styles/build/libHandback.css`, `print.css`).
      data-handback=""
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
      // The band is the frame: an ink band (a thing you do) declares its
      // ground once, and its stamps, chips and cost read it in CSS (chrome K1).
      data-ground={paint.ink ? 'ink' : undefined}
      data-grain={paint.grain}
      data-notch={cut || undefined}
      style={{ backgroundColor: paint.background, color: paint.color }}
    >
      {top && <div className="su-entity-row__top">{top}</div>}
      <div className="su-entity-row__line">
        {art}
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
        {affordance}
      </div>
    </div>
  )
}

const NO_CHIPS: ChipSet = { durations: [], facts: [], tags: [] }

type ChipsProps = Parameters<typeof Chips>[0]

const none = (node: ReactNode) => node === undefined || node === null || node === false

/**
 * A head's chips as one `Chips` strip (C2a): a strip passes through; any
 * other chip a host hands the head (a label-only `Stat`, a stamp) is drawn by
 * `Chips` as its marks, so every head strip names its classes. The host's
 * controls are the strip's last slot (C8, hard rule R6): the menu lane, ahead
 * of a "⋯" already there, so nothing sits beside the strip.
 */
function asStrip(chips: ReactNode, controls: ReactNode): ReactNode {
  if (none(chips) && none(controls)) return undefined
  if (isValidElement<ChipsProps>(chips) && chips.type === Chips) {
    if (none(controls)) return chips
    const menu = chips.props.menu
    return cloneElement(chips, { menu: none(menu) ? controls : [controls, menu] })
  }
  return (
    <Chips
      chips={NO_CHIPS}
      size="compact"
      marks={none(chips) ? undefined : chips}
      menu={none(controls) ? undefined : controls}
    />
  )
}
