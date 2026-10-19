import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { Ghost } from '../atoms/Ghost'
import { loadingCopy } from './loadingCopy'
import { Stack } from './Stack'

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

const CARD_BODY = { padding: space[8] } satisfies CSSProperties

type SkeletonShape = 'card' | 'rows'

type SkeletonProps = {
  /**
   * The form it stands in for: 'card' (default) the compact card; 'rows' a
   * list of `count` Rows.
   */
  shape?: SkeletonShape
  /** 'rows' only: how many Rows (default 3). */
  count?: number
  /** What is loading, for the status's name: `the crew` → "Loading the crew…". */
  label?: string
}

type SkeletonFrameProps = {
  /** What is loading, for the status's name: "Loading <label>…". */
  label?: string
  /** The frame's element: a list of ghosts is a `ul`. */
  as?: 'div' | 'ul'
  /** The frame the ghosts stand in for (its size, ground and edge). */
  style?: CSSProperties
  /** The ghosts; an empty frame is a ghost on its own. */
  children?: ReactNode
}

/**
 * The loading status every skeleton is: the announced name and the pulse
 * (`.su-pulse`, which a reduced-motion reader never sees). A composed skeleton
 * (`RosterSkeleton`, `SheetSkeleton`, a QR tile's) lays its ghosts inside it,
 * so the pulse and the words stay here (chrome.md K6).
 */
export function SkeletonFrame({ label, as: As = 'div', style, children }: SkeletonFrameProps) {
  return (
    <As role="status" aria-label={loadingCopy(label)} className="su-pulse" style={style}>
      {children}
    </As>
  )
}

/** One Row-shaped ghost plate, unannounced: the unit 'rows' (and
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
      <Stack gap={8} style={CARD_BODY}>
        {BODY_LINES.map((width) => (
          <Ghost key={width} style={{ height: space[12], width }} />
        ))}
      </Stack>
    </>
  )
}

/**
 * Skeleton — the loading placeholder for a shape known ahead (chrome.md K6).
 *
 * Mirrors the anatomy of the form it stands in for with **ink-alpha ghosts on
 * off-white**, so the loaded content drops in with **zero layout shift**: the
 * compact (medium) card's frame / band / body by default, or a list of Rows.
 */
export function Skeleton({ shape = 'card', count = 3, label }: SkeletonProps) {
  if (shape === 'rows') {
    return (
      <SkeletonFrame as="ul" label={label} style={ROWS}>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders with no identity of their own
          <li key={i}>
            <GhostRow />
          </li>
        ))}
      </SkeletonFrame>
    )
  }
  return (
    <SkeletonFrame label={label} style={CARD}>
      <CardGhost />
    </SkeletonFrame>
  )
}
