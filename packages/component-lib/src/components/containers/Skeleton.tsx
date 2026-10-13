import type { CSSProperties } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { Ghost } from '../atoms/Ghost'

type SkeletonMode = 'card' | 'list' | 'text'

type SkeletonProps = {
  /** Anatomy to mirror: a framed card, a stack of rows, or lines of text. */
  mode?: SkeletonMode
  /** Row / line count for `list` and `text` (and body lines for `card`). */
  rows?: number
  /** `card` only: mirror the compact (medium) card density — shorter band,
   * tighter body (the absorbed `CardSkeleton compact`). */
  compact?: boolean
  className?: string
}

/** A text line's width: the last runs short, the rest alternate full / 80%. */
function lineWidth(i: number, rows: number): string {
  return i === rows - 1 ? '60%' : i % 2 === 0 ? '100%' : '80%'
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[8] } satisfies CSSProperties

const LIST_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: space[12],
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  borderColor: color.ink15,
  backgroundColor: color.paper,
  padding: `${space[10]} ${space[12]}`,
} satisfies CSSProperties

const LIST_LINES = {
  display: 'flex',
  minWidth: 0,
  flex: 1,
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

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
} satisfies CSSProperties

/**
 * Skeleton — the generic loading placeholder (ruleset §"Skeleton").
 *
 * Mirrors the real anatomy (frame / band / body) with **ink-alpha ghosts on
 * off-white**, so the loaded content drops in with **zero layout shift**. The
 * former card-specific `CardSkeleton` is absorbed here as `mode="card"` (+
 * `compact`); this is the atom, driven by `mode` + `rows`. The pulse is
 * `.su-pulse`, which a reduced-motion reader never sees.
 */
export function Skeleton({ mode = 'card', rows = 3, compact = false, className }: SkeletonProps) {
  if (mode === 'text') {
    return (
      <div role="status" aria-label="Loading" className={cn('su-pulse', className)} style={STACK}>
        {Array.from({ length: rows }).map((_, i) => (
          <Ghost
            // biome-ignore lint/suspicious/noArrayIndexKey: ghost lines are positional
            key={i}
            style={{ height: space[12], width: lineWidth(i, rows) }}
          />
        ))}
      </div>
    )
  }

  if (mode === 'list') {
    return (
      <div role="status" aria-label="Loading" className={cn('su-pulse', className)} style={STACK}>
        {Array.from({ length: rows }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ghost rows are positional
          <div key={i} style={LIST_ROW}>
            <div style={LIST_LINES}>
              <Ghost style={{ height: space[14], width: '40%' }} />
              <Ghost style={{ height: space[10], width: '60%' }} />
            </div>
            <Ghost style={{ height: space[24], width: '56px' }} />
          </div>
        ))}
      </div>
    )
  }

  // card — frame + band + body, mirroring the Card anatomy. `compact`
  // mirrors the medium (compact) card density: shorter band, tighter body.
  return (
    <div role="status" aria-label="Loading" className={cn('su-pulse', className)} style={CARD}>
      <div
        style={{
          ...CARD_BAND,
          minHeight: compact ? '60px' : '80px',
          padding: compact ? `${space[8]} ${space[12]}` : `${space[10]} ${space[12]}`,
        }}
      >
        <Ghost
          style={{
            width: '40%',
            height: compact ? space[16] : space[24],
            backgroundColor: color.ink20,
          }}
        />
        <Ghost
          style={{
            width: '25%',
            height: compact ? space[12] : space[16],
            backgroundColor: color.ink15,
          }}
        />
      </div>
      <div style={{ ...STACK, padding: compact ? space[8] : space[12] }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Ghost
            // biome-ignore lint/suspicious/noArrayIndexKey: ghost body lines are positional
            key={i}
            style={{ height: compact ? space[12] : space[16], width: lineWidth(i, rows) }}
          />
        ))}
      </div>
    </div>
  )
}
