/**
 * RosterSkeleton — a `SkeletonFrame` composed as the Pilots/Mechs/Crawlers
 * grid while entityStore hydration is in flight.
 *
 * Mirrors the hydrated layout (the same grid shell, `.su-roster-skeleton`, and
 * the shared Row ghost, `GhostRow`) so the swap to real content doesn't shift the
 * page. Columns 2–3 hide below `md`, matching the mobile single-column view.
 */

import type { CSSProperties } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { Ghost } from '../atoms/Ghost'
import { GhostRow, SkeletonFrame } from './Skeleton'

const COLUMN_HEAD = {
  marginBottom: space[12],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
} satisfies CSSProperties

const COLUMN_TITLE = {
  height: space[20],
  width: '96px',
  backgroundColor: color.ink20,
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

const ROWS = { display: 'flex', flexDirection: 'column', gap: space[12] } satisfies CSSProperties

/** One list item of the shared Row ghost (`Skeleton`'s 'row' shape). */
function SkeletonRow() {
  return (
    <li style={{ listStyle: 'none' }}>
      <GhostRow />
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

type RosterSkeletonProps = {
  /** What is loading, for the status's name: "Loading <label>…". */
  label?: string
}

export function RosterSkeleton({ label = 'saved builds' }: RosterSkeletonProps) {
  return (
    <SkeletonFrame label={label}>
      <div className="su-roster-skeleton">
        <SkeletonColumn />
        <SkeletonColumn hiddenOnMobile />
        <SkeletonColumn hiddenOnMobile />
      </div>
    </SkeletonFrame>
  )
}
