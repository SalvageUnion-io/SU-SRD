/**
 * RosterSkeleton — shimmer placeholder for the Pilots/Mechs/Crawlers grid
 * while entityStore hydration is in flight (design review U-2).
 *
 * Mirrors the hydrated layout (the same grid shell, `.su-roster-skeleton`, and
 * Row-shaped placeholders) so the swap to real content doesn't shift the
 * page. Columns 2–3 hide below `md`, matching the mobile single-column view.
 */

import type { CSSProperties } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { Ghost } from '../skeleton/Skeleton'

const ROW = {
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  borderColor: color.ink15,
  backgroundColor: color.paper,
  padding: `${space[10]} ${space[12]}`,
} satisfies CSSProperties

const COLUMN_HEAD = {
  marginBottom: space[12],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
} satisfies CSSProperties

const COLUMN_TITLE = {
  height: space[20],
  width: '96px',
  backgroundColor: `color-mix(in oklab, ${color.ink} 25%, transparent)`,
} satisfies CSSProperties

const COLUMN_ACTION = {
  height: space[28],
  width: '112px',
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  borderColor: color.ink10,
  backgroundColor: color.paper,
} satisfies CSSProperties

const ROWS = { display: 'flex', flexDirection: 'column', gap: space[10] } satisfies CSSProperties

/** Row-shaped shimmer placeholder matching component-lib's `Row` frame. */
function SkeletonRow() {
  return (
    <li style={{ listStyle: 'none' }}>
      <div style={ROW}>
        <Ghost style={{ height: space[16], width: '40%' }} />
        <Ghost
          style={{
            marginTop: space[8],
            height: space[12],
            width: '60%',
            backgroundColor: color.ink5,
          }}
        />
      </div>
    </li>
  )
}

function SkeletonColumn({ hiddenOnMobile = false }: { hiddenOnMobile?: boolean }) {
  return (
    <section aria-hidden="true" className={hiddenOnMobile ? 'su-roster-skeleton-wide' : undefined}>
      <div style={COLUMN_HEAD}>
        <Ghost style={COLUMN_TITLE} />
        <Ghost style={COLUMN_ACTION} />
      </div>
      <ul style={ROWS}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </ul>
    </section>
  )
}

export function RosterSkeleton() {
  return (
    <div role="status" aria-label="Loading saved builds" className="su-pulse">
      <div className="su-roster-skeleton">
        <SkeletonColumn />
        <SkeletonColumn hiddenOnMobile />
        <SkeletonColumn hiddenOnMobile />
      </div>
    </div>
  )
}
