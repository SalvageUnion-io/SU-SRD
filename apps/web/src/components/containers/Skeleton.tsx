import type { CSSProperties } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { Ghost } from '../atoms/Ghost'

/** The body's ghost lines: the last runs short, the rest alternate full / 80%. */
const BODY_LINES = ['100%', '80%', '60%']

const CARD = {
  overflow: 'hidden',
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  borderColor: color.ink15,
  backgroundColor: color.paper,
} satisfies CSSProperties

const CARD_BAND = {
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  backgroundColor: color.ink10,
  minHeight: '60px',
  padding: `${space[8]} ${space[12]}`,
} satisfies CSSProperties

/** Row's frame (`entity/forms/Row`): a paper plate with a hairline edge. */
const ROW = {
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  borderColor: color.ink15,
  backgroundColor: color.paper,
  padding: `${space[10]} ${space[12]}`,
} satisfies CSSProperties

const ROW_TITLE = { height: space[16], width: '40%' } satisfies CSSProperties

const ROW_SUB = {
  marginTop: space[8],
  height: space[12],
  width: '60%',
  backgroundColor: color.ink5,
} satisfies CSSProperties

const ROWS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[10],
  margin: 0,
  padding: 0,
  listStyle: 'none',
} satisfies CSSProperties

/** Tile's frame (`entity/forms/Tile`): the art at 3:4 over the name band. */
const TILE = {
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  borderColor: color.ink15,
  backgroundColor: color.paper,
} satisfies CSSProperties

const TILE_ART = { aspectRatio: '3 / 4', borderRadius: 0 } satisfies CSSProperties

const TILE_BAND = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: color.ink10,
  padding: `${space[8]} ${space[12]}`,
} satisfies CSSProperties

const CARD_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: space[8],
} satisfies CSSProperties

type SkeletonShape = 'card' | 'row' | 'rows' | 'tile'

type SkeletonProps = {
  /**
   * The form it stands in for: 'card' (default) the compact card; 'row' one
   * Row; 'rows' a list of `count` Rows; 'tile' one catalog Tile.
   */
  shape?: SkeletonShape
  /** 'rows' only: how many Rows (default 3). */
  count?: number
  /** The status's accessible name (default "Loading"). */
  label?: string
}

/** One Row-shaped ghost plate, unannounced: the unit 'row' and 'rows' (and
 * `RosterSkeleton`'s columns) are built from. */
export function GhostRow() {
  return (
    <div style={ROW}>
      <Ghost style={ROW_TITLE} />
      <Ghost style={ROW_SUB} />
    </div>
  )
}

function CardGhost() {
  return (
    <>
      <div style={CARD_BAND}>
        <Ghost style={{ width: '40%', height: space[16], backgroundColor: color.ink20 }} />
        <Ghost style={{ width: '25%', height: space[12], backgroundColor: color.ink15 }} />
      </div>
      <div style={CARD_BODY}>
        {BODY_LINES.map((width) => (
          <Ghost key={width} style={{ height: space[12], width }} />
        ))}
      </div>
    </>
  )
}

function TileGhost() {
  return (
    <>
      <Ghost style={TILE_ART} />
      <div style={TILE_BAND}>
        <Ghost style={{ width: '60%', height: space[16], backgroundColor: color.ink20 }} />
      </div>
    </>
  )
}

/**
 * Skeleton — the generic loading placeholder (ruleset §"Skeleton").
 *
 * Mirrors the anatomy of the form it stands in for with **ink-alpha ghosts on
 * off-white**, so the loaded content drops in with **zero layout shift**: the
 * compact (medium) card's frame / band / body by default, or a Row, a list of
 * Rows, or a catalog Tile. The pulse is `.su-pulse`, which a reduced-motion
 * reader never sees.
 */
export function Skeleton({ shape = 'card', count = 3, label = 'Loading' }: SkeletonProps) {
  if (shape === 'rows') {
    return (
      <ul role="status" aria-label={label} className="su-pulse" style={ROWS}>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders with no identity of their own
          <li key={i}>
            <GhostRow />
          </li>
        ))}
      </ul>
    )
  }
  if (shape === 'row') {
    return (
      <div role="status" aria-label={label} className="su-pulse">
        <GhostRow />
      </div>
    )
  }
  return (
    <div
      role="status"
      aria-label={label}
      className="su-pulse"
      style={shape === 'tile' ? TILE : CARD}
    >
      {shape === 'tile' ? <TileGhost /> : <CardGhost />}
    </div>
  )
}
