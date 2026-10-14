import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../../design/tokens'
import { KindLabel } from '../../../entity/parts/KindLabel'
import { cn } from '../../../utils/cn'
import type { CardSize } from '../../containers/displayMode'
import type { HeaderFill } from './cardChrome'
import type { CardGrain } from './cardGrain'
import { grainClass } from './cardGrain'
import type { CardTitleTag } from './referenceEntityCardTypes'

type EntityCardHeaderProps = {
  title: string
  /** The entity's kind, for screen readers only (`KindLabel`): never a stamp. */
  kind?: string
  /** TONE (things you have) or INK (things you do) — see `HeaderFill`. */
  fill: HeaderFill
  /** The band's fill as a CSS colour — the tone, a guide tone, the ink banner,
   *  the damaged grey. `undefined` leaves it paper. */
  bandColor: string | undefined
  /** Title font size from the DEPTH ladder (`titleSizeRung`), as a CSS value. */
  titleSize: string
  /** On-band text colour (ink or paper), resolved by contrast. */
  titleColor?: string
  /** The title's element (`ReferenceEntityCardProps.titleAs`); default `span`. */
  titleAs?: CardTitleTag
  /** An ability's tier numeral, at the left of the ink banner (title size, dimmed). */
  numeral?: string
  /** The entity's chip group (`Chips`): right of the title where it fits, else under it. */
  chips?: ReactNode
  /** The Dashboard's pennant button, at the right. */
  pennant?: ReactNode
  /**
   * The labels (`CardLabels`): the seal, the classification pills, the
   * User-made stamp. On the title's line, right after the title.
   */
  labels?: ReactNode
  size: CardSize
  /** The light speckle (ruleset §3.5) — `ink` on a tone, `paper` on ink. */
  grain?: CardGrain
  /** Draw the 1.5px ink rule that closes the band, when anything follows it. */
  ruled?: boolean
}

/** The band's padding by size (board E1). */
const PAD: Record<CardSize, string> = {
  large: `${space[12]} ${space[14]}`,
  medium: `${space[8]} ${space[10]}`,
  small: `${space[6]} ${space[8]}`,
}

/*
 * The band's frame, the title's caps face, the heading (the name group and
 * the chips), and the end column are `.su-ec-band*` classes
 * (`styles/partials/card-chrome.css`), not style objects: every card and
 * listing row repeats them (ADR-046, repeated elements). What varies by card
 * stays inline: the band's fill and padding, the title's size and colour.
 */

/**
 * EntityCardHeader — the card's flush header band, ONE anatomy with TWO fills
 * (ruleset §5, board E1):
 *
 * - TONE, for things you have: the entity's tone, ink speckle, the title in
 *   ink or paper (whichever passes contrast).
 * - INK, for things you do: the book's ink banner — the tier numeral at the
 *   left (title size, dimmed), the title, paper flecks.
 *
 * The HEADING is the title with its labels, then the chip group (E17). The
 * band decides the chips' place by its own width, with no viewport rule: the
 * name keeps its natural one-line width (it grows, never shrinks, to share a
 * line), so the chips sit right of it where they fit and drop whole onto a
 * line of their own under it where they do not. The title wraps only when it
 * alone is wider than the band, and is never cut (E18). The pennant button
 * is the END column, centred on the whole band, so it is never left alone
 * on a line.
 */
export function EntityCardHeader({
  title,
  kind,
  fill,
  bandColor,
  titleSize,
  titleColor = 'var(--color-ink)',
  titleAs,
  numeral,
  chips,
  pennant,
  labels,
  size,
  grain,
  ruled = false,
}: EntityCardHeaderProps) {
  const TitleTag = titleAs ?? 'span'
  const titleType: CSSProperties = { color: titleColor, fontSize: titleSize }
  return (
    <div
      data-fill={fill}
      data-grain={grain}
      className={cn('su-ec-band', ruled && 'su-ec-band--ruled', grainClass(grain))}
      style={{
        backgroundColor: bandColor ?? 'var(--color-paper)',
        padding: PAD[size],
      }}
    >
      {numeral && (
        <span className="su-ec-band__title su-ec-band__numeral" style={titleType}>
          {numeral}
        </span>
      )}
      <div className="su-ec-band__heading">
        <div className="su-ec-band__name">
          <TitleTag className="su-ec-band__title su-ec-band__title--wrap" style={titleType}>
            <span>{title}</span>
            <KindLabel kind={kind} />
          </TitleTag>
          {labels && <div className="su-ec-band__labels">{labels}</div>}
        </div>
        {chips}
      </div>
      {pennant && <div className="su-ec-band__end">{pennant}</div>}
    </div>
  )
}
