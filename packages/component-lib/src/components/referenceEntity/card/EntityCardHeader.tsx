import { ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../../design/tokens'
import { cn } from '../../../utils/cn'
import type { CardSize } from '../../shared/displayMode'
import type { StatItem } from '../../shared/statsBarTypes'
import { accentSurface } from '../referenceEntityHelpers'
import type { HeaderFill } from './cardChrome'
import type { CardGrain } from './cardGrain'
import { grainStyle } from './cardGrain'
import { EntityCardStatBox } from './EntityCardStatBox'

type EntityCardHeaderProps = {
  title: string
  /** TONE (things you have) or INK (things you do) — see `HeaderFill`. */
  fill: HeaderFill
  /** The tone as a Tailwind bg class (tone fill only). */
  bg: string | undefined
  /** The band as a raw CSS colour — a guide tone, the ink banner, the damaged grey. */
  bgColor: string | undefined
  /** Title type-scale class from the DEPTH ladder (`titleSizeClass`). */
  titleClass: string
  /** On-band text colour class (`text-ink` / `text-paper`), resolved by contrast. */
  titleTextClass?: string
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
  /** The cost pennant (read) or the pennant button (Dashboard), at the right. */
  pennant?: ReactNode
  /**
   * HEAD extent: the card is ONE LINE (ruleset §1 Listing). The title
   * truncates with "…" and keeps its full name in a tooltip; the stats,
   * pennant and controls never wrap.
   */
  oneLine?: boolean
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

/** The band's padding by size (board E1): room above for the seam stamp. */
const PAD: Record<CardSize, string> = {
  large: `${space[16]} ${space[14]} ${space[12]}`,
  medium: `${space[14]} ${space[10]} ${space[8]}`,
  small: `${space[12]} ${space[8]} ${space[6]}`,
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

/** The title's truncation, without containment: it keeps its full width. */
const TRUNCATE: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/**
 * A one-line head row's columns (board E3). A grid, because its tracks rank the
 * parts where a flex row only weighs them:
 *
 * - the TITLE's track is `minmax(0, max-content)`: it fills to the full name
 *   before any `fr` track gets a pixel, so every cell drops before the name
 *   truncates;
 * - the CELLS (and a hint) share what is left (`minmax(0, 1fr)`), and the
 *   cells drop last-first in it (`EntityCardStatBox`); a row with neither
 *   keeps an empty `fr` track, so the pennant and chevron stay at the right;
 * - the numeral, the pennant and the chevron keep their own width.
 *
 * The 0 minimums also mean a long name adds nothing to the row's min-content,
 * so it cannot push a width-less ancestor (an island page's wrapper) past the
 * viewport.
 */
function oneLineColumns(parts: {
  numeral: boolean
  hint: boolean
  cells: boolean
  pennant: boolean
  chevron: boolean
}): string {
  return [
    parts.numeral && 'auto',
    'minmax(0, max-content)',
    parts.hint && 'minmax(0, 1fr)',
    (parts.cells || !parts.hint) && 'minmax(0, 1fr)',
    parts.pennant && 'auto',
    parts.chevron && 'auto',
  ]
    .filter(Boolean)
    .join(' ')
}

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
 * band is too narrow. A one-line head row never wraps: its cells drop, last
 * first, and only then does its title truncate.
 */
export function EntityCardHeader({
  title,
  fill,
  bg,
  bgColor,
  titleClass,
  titleTextClass = 'text-ink',
  titleSlot,
  titleAs,
  numeral,
  stats,
  rightContent,
  pennant,
  oneLine = false,
  size,
  band = false,
  grain,
  ruled = false,
  chevron = false,
}: EntityCardHeaderProps) {
  const accent = accentSurface(bg, bgColor)
  const TitleTag = titleAs ?? 'span'
  const titleType = cn(
    'font-cond font-extrabold uppercase leading-none tracking-caps-tight',
    titleTextClass,
    titleClass
  )
  const titleNode = titleSlot ?? (
    <TitleTag
      className={titleType}
      title={oneLine ? title : undefined}
      style={{
        // One line: a grid track (`oneLineColumns`) holds the full name, and the
        // title truncates only once every cell has dropped. Otherwise the title
        // shares the row with the cells on the right at medium and small, and
        // only a large header gives the title the whole row; the cells wrap
        // beneath when they truly cannot fit.
        ...(oneLine
          ? { minWidth: 0, ...TRUNCATE }
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
      className={cn('font-body italic leading-snug', titleTextClass)}
      style={
        oneLine
          ? { minWidth: 0, textAlign: 'right', ...ONE_LINE }
          : { flex: '1 1 12rem', minWidth: 0, textAlign: 'right' }
      }
    >
      {rightContent}
    </span>
  ) : null
  const cells = stats.length > 0 ? <EntityCardStatBox stats={stats} oneRow={oneLine} /> : null
  const hasCluster = !!cells || !!pennant
  const chevronNode = chevron ? (
    <ChevronRight
      aria-hidden="true"
      size={20}
      strokeWidth={3}
      className={titleTextClass}
      style={{ flex: 'none', marginLeft: hasCluster || oneLine ? 0 : 'auto' }}
    />
  ) : null
  const numeralNode = numeral ? (
    <span className={titleType} style={{ flex: 'none', opacity: 0.75 }}>
      {numeral}
    </span>
  ) : null
  const bandStyle: CSSProperties = {
    ...accent.style,
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
    padding: band ? BAND_PAD[size] : PAD[size],
    width: '100%',
  }

  // HEAD extent: ONE line, on ranked grid tracks (`oneLineColumns`).
  if (oneLine) {
    return (
      <div
        data-fill={fill}
        data-grain={grain}
        className={accent.className}
        style={{
          ...bandStyle,
          columnGap: space[8],
          display: 'grid',
          gridTemplateColumns: oneLineColumns({
            numeral: !!numeralNode,
            hint: !!hint,
            cells: !!cells,
            pennant: !!pennant,
            chevron: !!chevronNode,
          }),
        }}
      >
        {numeralNode}
        {titleNode}
        {hint}
        {cells ?? (hint ? null : <span aria-hidden="true" />)}
        {pennant}
        {chevronNode}
      </div>
    )
  }

  return (
    <div
      data-fill={fill}
      data-grain={grain}
      className={accent.className}
      style={{
        ...bandStyle,
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${space[8]} ${space[14]}`,
      }}
    >
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
          {pennant}
        </div>
      )}
      {chevronNode}
    </div>
  )
}
