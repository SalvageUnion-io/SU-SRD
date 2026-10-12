import { ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { font, space, tracking, weight } from '../../../design/tokens'
import { Badge } from '../../chrome/Badge'
import type { CardSize } from '../../shared/displayMode'
import type { StatItem } from '../../shared/statsBarTypes'
import type { HeaderFill } from './cardChrome'
import type { CardGrain } from './cardGrain'
import { grainStyle } from './cardGrain'
import { EntityCardStatBox } from './EntityCardStatBox'

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
  /** SEO: render the title as an `h1` (item pages) instead of the default `span`. */
  titleAs?: 'span' | 'h1'
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
   * User-made stamp. The band's first line, in flow above the title.
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

/**
 * The compact title: it takes the row's room and wraps to two lines, then
 * clamps with "…". `minWidth: 0` keeps a long name out of the row's
 * min-content, so it cannot push a width-less ancestor (an island page's
 * wrapper) past the viewport.
 */
const CLAMP_TWO: CSSProperties = {
  display: '-webkit-box',
  flex: '1 1 0',
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
}

/**
 * The title's caps face; its size and colour come from the band. No line
 * height of its own: the title inherits the band's, which is what it rendered
 * with under Tailwind (the size class after `leading-none` had tailwind-merge
 * drop it).
 */
const TITLE_TYPE: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.extrabold,
  textTransform: 'uppercase',
  letterSpacing: tracking.capsTight,
}

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
  const titleType: CSSProperties = { ...TITLE_TYPE, color: titleColor, fontSize: titleSize }
  const titleNode = titleSlot ?? (
    <TitleTag
      title={head ? title : undefined}
      style={{
        ...titleType,
        // A compact head: the title takes the row and wraps to two lines
        // before it clamps (see `CLAMP_TWO`). Otherwise the title shares the
        // row with the cells on the right at medium and small, and only a
        // large header gives the title the whole row; the cells wrap beneath
        // when they truly cannot fit.
        ...(head
          ? CLAMP_TWO
          : {
              flex: size === 'large' ? '1 1 auto' : '1 1 0',
              minWidth: size === 'large' ? 0 : 'min-content',
              overflowWrap: 'break-word',
            }),
      }}
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
    <span style={{ ...titleType, flex: 'none', opacity: 0.75 }}>{numeral}</span>
  ) : null
  const bandStyle: CSSProperties = {
    backgroundColor: bandColor ?? 'var(--color-paper)',
    ...grainStyle(grain),
    alignItems: 'center',
    ...(ruled
      ? {
          borderBottomColor: 'var(--color-ink)',
          borderBottomStyle: 'solid',
          borderBottomWidth: 'var(--bw-chrome)',
        }
      : {}),
    minWidth: 0,
    padding: band ? BAND_PAD[size] : head ? HEAD_PAD[size] : PAD[size],
    width: '100%',
  }

  // HEAD extent: one row that never wraps; the title wraps inside it.
  if (head) {
    return (
      <div
        data-fill={fill}
        data-grain={grain}
        style={{
          ...bandStyle,
          columnGap: space[8],
          display: 'flex',
          flexWrap: 'nowrap',
        }}
      >
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
    <div
      data-fill={fill}
      data-grain={grain}
      style={{
        ...bandStyle,
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${space[8]} ${space[14]}`,
      }}
    >
      {/* The labels take a line of their own, above the title. */}
      {labels && <div style={{ flex: '1 1 100%', minWidth: 0 }}>{labels}</div>}
      {numeralNode}
      {titleNode}
      {hint}
      {hasCluster && (
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flex: '0 1 auto',
            flexWrap: 'wrap',
            gap: space[4],
            justifyContent: 'flex-end',
            minWidth: 0,
          }}
        >
          {cells}
          {stampNodes}
          {pennant}
        </div>
      )}
      {chevronNode}
    </div>
  )
}
