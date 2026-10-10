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

/** The one-line row's spacing between its parts (margins, not `gap`). */
const ONE_LINE_GAP = space[8]

/**
 * The one-line cell box's shrink factor. Shrink is weighted by base width, so
 * the title's share of a deficit is title / (title + cells × this): at a
 * million it stays far below a layout pixel until the cells are gone.
 */
const CELL_SHRINK = 1_000_000

/**
 * A truncating one-liner. `contain: inline-size` gives it NO min-content
 * contribution: a nowrap title or hint would otherwise add its whole text
 * length to a width-less ancestor (an island page's wrapper) and push the
 * page wider than the viewport.
 */
const ONE_LINE: CSSProperties = {
  contain: 'inline-size',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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
 * band is too narrow; a one-line head row never wraps, so its title truncates.
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
        // One line: the NAME wins the row. The cells give way first, whole and
        // last first (`EntityCardStatBox`), and the title truncates only when
        // it alone cannot fit beside the pennant and chevron. Otherwise the
        // title shares the row with the cells on the right at medium and
        // small, and only a large header gives the title the whole row; the
        // cells wrap beneath when they truly cannot fit.
        flex: oneLine ? '0 1 auto' : size === 'large' ? '1 1 auto' : '1 1 0',
        minWidth: oneLine ? 0 : size === 'large' ? 0 : 'min-content',
        overflowWrap: 'break-word',
        ...(oneLine ? ONE_LINE : {}),
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
          ? {
              flex: '1 1 0',
              marginLeft: ONE_LINE_GAP,
              minWidth: 0,
              textAlign: 'right',
              ...ONE_LINE,
            }
          : { flex: '1 1 12rem', minWidth: 0, textAlign: 'right' }
      }
    >
      {rightContent}
    </span>
  ) : null
  const hasCluster = stats.length > 0 || !!pennant

  return (
    <div
      data-fill={fill}
      data-grain={grain}
      className={accent.className}
      style={{
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
        display: 'flex',
        flexWrap: oneLine ? 'nowrap' : 'wrap',
        // One line spaces its parts with margins: a cell box shrunk to nothing
        // must not still hold two gaps' room from the title.
        gap: oneLine ? 0 : `${space[8]} ${space[14]}`,
        minWidth: 0,
        padding: band ? BAND_PAD[size] : PAD[size],
        width: '100%',
      }}
    >
      {numeral && (
        <span
          className={titleType}
          style={{ flex: 'none', marginRight: oneLine ? ONE_LINE_GAP : undefined, opacity: 0.75 }}
        >
          {numeral}
        </span>
      )}
      {titleNode}
      {hint}
      {oneLine ? (
        <>
          {stats.length > 0 && (
            <div
              style={{
                display: 'flex',
                // The cells take all of the shrink: the title gives way only
                // once every cell has gone (flex-shrink is weighted by width,
                // so the factor is large enough that the title's share stays
                // below a pixel). The box clips; its cells drop out whole.
                flex: `0 ${CELL_SHRINK} auto`,
                justifyContent: 'flex-end',
                marginLeft: 'auto',
                minWidth: 0,
              }}
            >
              <EntityCardStatBox stats={stats} oneRow lead={ONE_LINE_GAP} />
            </div>
          )}
          {pennant && (
            <span
              style={{
                display: 'flex',
                flex: 'none',
                marginLeft: stats.length > 0 ? ONE_LINE_GAP : 'auto',
                paddingLeft: stats.length > 0 ? 0 : ONE_LINE_GAP,
              }}
            >
              {pennant}
            </span>
          )}
        </>
      ) : (
        hasCluster && (
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
            {stats.length > 0 && <EntityCardStatBox stats={stats} />}
            {pennant}
          </div>
        )
      )}
      {chevron && (
        // A head row's chevron (only head rows carry one): it never shrinks,
        // and keeps a gap's room from whatever precedes it.
        <span
          style={{
            display: 'flex',
            flex: 'none',
            marginLeft: hasCluster ? ONE_LINE_GAP : 'auto',
            paddingLeft: hasCluster ? 0 : ONE_LINE_GAP,
          }}
        >
          <ChevronRight aria-hidden="true" size={20} strokeWidth={3} className={titleTextClass} />
        </span>
      )}
    </div>
  )
}
