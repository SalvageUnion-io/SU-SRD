import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, fontSize, space } from '../../../design/tokens'
import type { CardSize } from '../../shared/displayMode'
import type { StatItem } from '../../shared/statsBarTypes'
import { hasCompactBody } from './compactLead'
import { EntityCardStatBox } from './EntityCardStatBox'
import type { EntityCardSubHeaderCell } from './EntityCardSubHeader'
import { EntityCardSubHeader } from './EntityCardSubHeader'

/**
 * THE COMPACT CARD's parts (`extent="head"`, ruleset §1 Listing): one
 * rendering for every entity, wherever a card is a row — a listing, search, a
 * sheet slot, a nested card. Its head row is `EntityCardHeader` with `head`;
 * these are the two parts beside and under it.
 */

/** The body's padding: tight, under the head row. */
const BODY_PAD: Record<CardSize, string> = {
  large: `${space[6]} ${space[12]} ${space[8]}`,
  medium: `${space[4]} ${space[10]} ${space[6]}`,
  small: `${space[4]} ${space[8]} ${space[4]}`,
}

/** The lead: three lines of ink-2 prose under the cells, clamped with "…". */
const LEAD: CSSProperties = {
  color: color.ink2,
  display: '-webkit-box',
  flexBasis: '100%',
  fontSize: fontSize.sm,
  lineHeight: 1.4,
  margin: 0,
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
}

/**
 * The compact card's BODY: the value cells (`Stat` at its `full` rung, the
 * row's content), then, on the same line while it fits, the "//" line, then
 * the lead when the context asks for it.
 */
function CompactCardBody({
  stats,
  cells,
  leading,
  lead,
  size,
}: {
  stats: StatItem[]
  cells: EntityCardSubHeaderCell[]
  /** A node leading the "//" line — the "Suggested" stamp. */
  leading?: ReactNode
  /** The entity's opening prose (`leadProse`). */
  lead?: string
  size: CardSize
}) {
  return (
    <div
      style={{
        alignItems: 'center',
        borderTop: `${borderWidth.chrome} solid ${color.ink}`,
        display: 'flex',
        flex: '1 1 auto',
        flexWrap: 'wrap',
        gap: space[4],
        padding: BODY_PAD[size],
      }}
    >
      <EntityCardStatBox stats={stats} cellSize="full" align="start" />
      <EntityCardSubHeader cells={cells} leading={leading} size={size} flush="inline" />
      {lead && (
        <p style={LEAD} title={lead}>
          {lead}
        </p>
      )}
    </div>
  )
}

/** A thumbnail: the 440 rendition covers it at any density. */
const ART_SIZES = '5rem'

/**
 * The compact card's ART column: the entity's artwork, the card's full height,
 * beside the head and the body (`.su-ec-head-art`).
 */
function CompactCardArt({ src, srcSet }: { src: string; srcSet: string | undefined }) {
  return (
    <span className="su-ec-head-art">
      <img src={src} srcSet={srcSet} sizes={ART_SIZES} alt="" loading="lazy" decoding="async" />
    </span>
  )
}

/**
 * The compact card inside its frame: the art column (when the entity has art),
 * then the head row over the body.
 */
export function CompactCardFrame({
  frameStyle,
  art,
  artSrcSet,
  missingArt,
  header,
  body,
  bodyless,
  size,
}: {
  /** The card's frame box (its border, ground and clip), laid out as a row here. */
  frameStyle: CSSProperties
  art: string | undefined
  artSrcSet: string | undefined
  /** The column's stand-in when there is no art (`MissingArt`), or none to drop it. */
  missingArt: ReactNode
  header: ReactNode
  body:
    | { stats: StatItem[]; cells: EntityCardSubHeaderCell[]; leading?: ReactNode; lead?: string }
    | undefined
  /** A row that is its head alone (an inline band, a pattern row). */
  bodyless: boolean
  size: CardSize
}) {
  return (
    <div style={{ ...frameStyle, flexDirection: 'row' }}>
      {art ? (
        <CompactCardArt src={art} srcSet={artSrcSet} />
      ) : (
        missingArt && <span className="su-ec-head-art su-ec-head-art--missing">{missingArt}</span>
      )}
      <div style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minWidth: 0 }}>
        {header}
        {body &&
          !bodyless &&
          hasCompactBody(body.stats.length, !!body.leading || body.cells.length > 0, body.lead) && (
            <CompactCardBody {...body} size={size} />
          )}
      </div>
    </div>
  )
}
