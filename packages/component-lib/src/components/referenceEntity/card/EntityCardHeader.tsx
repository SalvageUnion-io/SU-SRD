import { ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { font, space } from '../../../design/tokens'
import { cn } from '../../../utils/cn'
import { Badge } from '../../atoms/Badge'
import type { CardSize } from '../../containers/displayMode'
import type { StatItem } from '../../containers/statsBarTypes'
import type { HeaderFill } from './cardChrome'
import type { CardGrain } from './cardGrain'
import { grainClass } from './cardGrain'
import { EntityCardStatBox } from './EntityCardStatBox'
import type { CardTitleTag } from './referenceEntityCardTypes'

type EntityCardHeaderProps = {
  title: string
  /** TONE (things you have) or INK (things you do) — see `HeaderFill`. */
  fill: HeaderFill
  /** The band's fill as a CSS colour — the tone, a guide tone, the ink banner,
   *  the damaged grey. `undefined` leaves it paper. */
  bandColor: string | undefined
  /** Title font size from the DEPTH ladder (`titleSizeRung`), as a CSS value. */
  titleSize: string
  /** On-band text colour (ink or paper), resolved by contrast. */
  titleColor?: string
  /** Write layer: a full replacement node for the title. */
  titleSlot?: ReactNode
  /** The title's element (`ReferenceEntityCardProps.titleAs`); default `span`. */
  titleAs?: CardTitleTag
  /** An ability's tier numeral, at the left of the ink banner (title size, dimmed). */
  numeral?: string
  /** The value cells, after the title. */
  stats: StatItem[]
  /** A one-line hint on the band (a pattern row's description), truncated. */
  rightContent?: ReactNode
  /** The action-type stamps (E17), before the pennant. */
  stamps?: string[]
  /** The cost pennant (read) or the pennant button (Dashboard), at the right. */
  pennant?: ReactNode
  /**
   * HEAD extent, the compact card (ruleset §1 Listing): one no-wrap row of the
   * numeral, the title, the pennant and the chevron. The title takes the room
   * and wraps to two lines before it clamps with "…" (its full name in a
   * tooltip). The value cells are not here: the compact card draws them in its
   * body, under the head.
   */
  head?: boolean
  /**
   * The labels (`CardLabels`): the type stamp, the classification pills, the
   * User-made stamp. On the title's line, right after the title.
   */
  labels?: ReactNode
  size: CardSize
  /**
   * An INLINE action band inside its host card (board E1): flush, tighter
   * vertical padding, the host's own gutter.
   */
  band?: boolean
  /** The light speckle (ruleset §3.5) — `ink` on a tone, `paper` on ink. */
  grain?: CardGrain
  /** Draw the 1.5px ink rule that closes the band (anything follows it). */
  ruled?: boolean
  /** A clickable listing row: E3's chevron (›) at the far right says it opens. */
  chevron?: boolean
}

/** The band's padding by size (board E1). */
const PAD: Record<CardSize, string> = {
  large: `${space[12]} ${space[14]}`,
  medium: `${space[8]} ${space[10]}`,
  small: `${space[6]} ${space[8]}`,
}

/** A compact head: tight all round. */
const HEAD_PAD: Record<CardSize, string> = {
  large: `${space[8]} ${space[12]} ${space[6]}`,
  medium: `${space[6]} ${space[10]} ${space[6]}`,
  small: `${space[4]} ${space[8]} ${space[4]}`,
}

/** An inline action band keeps its host's gutter. */
const BAND_PAD: Record<CardSize, string> = {
  large: `${space[8]} ${space[14]}`,
  medium: `${space[8]} ${space[10]}`,
  small: `${space[6]} ${space[8]}`,
}

/**
 * A truncating one-liner. `contain: inline-size` gives it NO intrinsic width:
 * the hint takes only the room the name and the cells leave it.
 */
const ONE_LINE: CSSProperties = {
  contain: 'inline-size',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/*
 * The band's frame, the title's caps face and layout, the name group and the
 * cell cluster are `.su-ec-band*` classes (`styles/index.css`), not style
 * objects: every card and listing row repeats them (ADR-046, repeated
 * elements). What varies by card stays inline: the band's fill and padding,
 * the title's size and colour.
 *
 * - `__title--clamp`, the compact title: it takes the row's room and wraps to
 *   two lines, then clamps with "…". `min-width: 0` keeps a long name out of
 *   the row's min-content, so it cannot push a width-less ancestor (an island
 *   page's wrapper) past the viewport.
 * - `__title--wrap`: at the start of the name group, its labels right after
 *   it, it wraps at spaces first (a high shrink) but keeps its longest word
 *   whole, and only then do the labels give way, truncating with "…".
 * - The title has no line height of its own: it inherits the band's, which is
 *   what it rendered with under the old utilities (the size class after
 *   `leading-none` had the class merge drop it).
 */

/** A hint on a compact head (a pattern row's description) takes the room the title leaves. */
const FILL: CSSProperties = { flex: '1 1 0', minWidth: 0 }

/**
 * EntityCardHeader — the card's flush header band, ONE anatomy with TWO fills
 * (ruleset §5, board E1):
 *
 * - TONE, for things you have: the entity's tone, ink speckle, the title in
 *   ink or paper (whichever passes contrast), the value cells after it.
 * - INK, for things you do: the book's ink banner — the tier numeral at the
 *   left (title size, dimmed), the title, the cost pennant at the right, paper
 *   flecks.
 *
 * The title takes the row and the cells follow it, wrapping beneath when the
 * band is too narrow. A compact HEAD keeps one row: the title wraps to two
 * lines inside it, and the cells move to the compact card's body.
 */
export function EntityCardHeader({
  title,
  fill,
  bandColor,
  titleSize,
  titleColor = 'var(--color-ink)',
  titleSlot,
  titleAs,
  numeral,
  stats,
  rightContent,
  stamps = [],
  pennant,
  head = false,
  labels,
  size,
  band = false,
  grain,
  ruled = false,
  chevron = false,
}: EntityCardHeaderProps) {
  const TitleTag = titleAs ?? 'span'
  const titleType: CSSProperties = { color: titleColor, fontSize: titleSize }
  const titleNode = titleSlot ?? (
    <TitleTag
      title={head ? title : undefined}
      className={cn(
        'su-ec-band__title',
        head ? 'su-ec-band__title--clamp' : 'su-ec-band__title--wrap'
      )}
      style={titleType}
    >
      {title}
    </TitleTag>
  )
  const hint = rightContent ? (
    <span
      style={{
        fontFamily: font.body,
        fontStyle: 'italic',
        lineHeight: 1.375,
        color: titleColor,
        ...(head
          ? { ...FILL, textAlign: 'right', ...ONE_LINE }
          : { flex: '1 1 12rem', minWidth: 0, textAlign: 'right' }),
      }}
    >
      {rightContent}
    </span>
  ) : null
  const cells = stats.length > 0 && !head ? <EntityCardStatBox stats={stats} /> : null
  const stampNodes = stamps.map((stamp) => (
    <Badge
      key={stamp}
      shape="stamp"
      size="mini"
      surface={fill === 'ink' ? 'inverse' : 'on-ink'}
      style={{ flex: 'none', whiteSpace: 'nowrap' }}
    >
      {stamp}
    </Badge>
  ))
  const hasCluster = !!cells || !!pennant || stamps.length > 0
  const chevronNode = chevron ? (
    <ChevronRight
      aria-hidden="true"
      size={20}
      strokeWidth={3}
      style={{ flex: 'none', color: titleColor, marginLeft: hasCluster || head ? 0 : 'auto' }}
    />
  ) : null
  const numeralNode = numeral ? (
    <span className="su-ec-band__title su-ec-band__numeral" style={titleType}>
      {numeral}
    </span>
  ) : null
  const bandStyle: CSSProperties = {
    backgroundColor: bandColor ?? 'var(--color-paper)',
    padding: band ? BAND_PAD[size] : head ? HEAD_PAD[size] : PAD[size],
  }
  const bandClass = (extent: 'head' | 'full') =>
    cn('su-ec-band', `su-ec-band--${extent}`, ruled && 'su-ec-band--ruled', grainClass(grain))

  // HEAD extent: one row that never wraps; the title wraps inside it.
  if (head) {
    return (
      <div data-fill={fill} data-grain={grain} className={bandClass('head')} style={bandStyle}>
        {numeralNode}
        {titleNode}
        {hint}
        {stampNodes}
        {pennant && <div style={{ display: 'flex', flex: 'none' }}>{pennant}</div>}
        {chevronNode}
      </div>
    )
  }

  return (
    <div data-fill={fill} data-grain={grain} className={bandClass('full')} style={bandStyle}>
      {numeralNode}
      {/* The name group: the title, its labels right after it. It shares the
        row with the cells on the right at medium and small, and only a large
        header gives it the whole row; the cells wrap beneath when they truly
        cannot fit. */}
      <div className={cn('su-ec-band__name', size === 'large' && 'su-ec-band__name--large')}>
        {titleNode}
        {labels && <div className="su-ec-band__labels">{labels}</div>}
      </div>
      {hint}
      {hasCluster && (
        <div className="su-ec-band__cluster">
          {cells}
          {stampNodes}
          {pennant}
        </div>
      )}
      {chevronNode}
    </div>
  )
}
