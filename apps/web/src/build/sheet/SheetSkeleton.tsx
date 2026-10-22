/**
 * SheetSkeleton — a `SkeletonFrame` composed as /sheet/:kind/:id while the
 * route loader hydrates the entity store.
 *
 * Mirrors the LiveSheet shell (sticky top bar → hero band → body slabs) so
 * the swap to the real sheet doesn't shift the page: same min-h-[58px] bar,
 * same horizontal padding rhythm, hero-sized frame, then two slab groups
 * (dashed-leader header + card placeholders). Ghost bars come from the shared
 * `Skeleton` atom (§0: one skeleton implementation), sized per region here.
 */

import type { CSSProperties } from 'react'
import { Ghost, SkeletonFrame, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

// Responsive padding, the slab rhythm and the slab grid's columns are
// `.su-sheet-skeleton-*` in `styles/sheet/chrome.css`; the rest is below.

const GHOST_LABEL = {
  height: tokens.space[16],
  backgroundColor: tokens.color.ink15,
} satisfies CSSProperties

const SLAB_HEAD = {
  marginBottom: tokens.space[14],
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space[12],
} satisfies CSSProperties

const SLAB_LEADER = { height: tokens.space[2], flex: '1 1 0%' } satisfies CSSProperties

const SLAB_GRID = { display: 'grid', gap: tokens.space[12] } satisfies CSSProperties

const SLAB_CARD = {
  height: '80px',
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink15}`,
  backgroundColor: tokens.color.paper,
} satisfies CSSProperties

const ROOT = { minHeight: '100vh', backgroundColor: tokens.color.wkBg } satisfies CSSProperties

const BAR = {
  display: 'flex',
  minHeight: '58px',
  alignItems: 'center',
  gap: tokens.space[16],
  borderBottom: `${tokens.borderWidth.pill} solid ${tokens.color.ink20}`,
  paddingBlock: tokens.space[8],
} satisfies CSSProperties

const BAR_ACTIONS = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space[8],
} satisfies CSSProperties

const BAR_BUTTON = {
  height: tokens.space[28],
  width: tokens.space[64],
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink10}`,
  backgroundColor: tokens.color.paper,
} satisfies CSSProperties

const HERO = { paddingBottom: tokens.space[6] } satisfies CSSProperties

const HERO_FRAME = {
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.entity} solid ${tokens.color.ink20}`,
  backgroundColor: tokens.color.paper,
} satisfies CSSProperties

const HERO_TITLE = {
  height: tokens.space[32],
  backgroundColor: tokens.color.ink15,
} satisfies CSSProperties

const HERO_SUB = {
  marginTop: tokens.space[12],
  height: tokens.space[16],
  width: '33.333333%',
} satisfies CSSProperties

const HERO_STATS = {
  marginTop: tokens.space[24],
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

const HERO_STAT = {
  height: '56px',
  width: '96px',
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink10}`,
  backgroundColor: tokens.color.wkBg,
} satisfies CSSProperties

function SkeletonSlab() {
  return (
    <div className="su-sheet-skeleton-slab">
      {/* Slab header: stamp + leader rule (src/components `Slab` shape) */}
      <div style={SLAB_HEAD}>
        <Ghost style={{ ...GHOST_LABEL, width: '112px' }} />
        <Ghost style={SLAB_LEADER} />
      </div>
      <div className="su-sheet-skeleton-grid" style={SLAB_GRID}>
        <div style={SLAB_CARD} />
        <div style={SLAB_CARD} />
      </div>
    </div>
  )
}

export function SheetSkeleton() {
  return (
    <SkeletonFrame label={buildSheetCopy('theSheet')} style={ROOT}>
      {/* Sticky-bar placeholder (LiveSheet top bar footprint) */}
      <div className="su-sheet-skeleton-bar" style={BAR}>
        <Ghost style={{ ...GHOST_LABEL, width: '96px' }} />
        <div style={BAR_ACTIONS}>
          <div style={BAR_BUTTON} />
          <div style={BAR_BUTTON} />
        </div>
      </div>

      {/* Hero band placeholder */}
      <div className="su-sheet-skeleton-hero" style={HERO}>
        <div className="su-sheet-skeleton-frame" style={HERO_FRAME}>
          <Ghost className="su-sheet-skeleton-title" style={HERO_TITLE} />
          <Ghost style={HERO_SUB} />
          <div style={HERO_STATS}>
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: ghost tiles are positional
              <div key={i} style={HERO_STAT} />
            ))}
          </div>
        </div>
      </div>

      {/* Body slab placeholders */}
      <div className="su-sheet-skeleton-body">
        <SkeletonSlab />
        <SkeletonSlab />
      </div>
    </SkeletonFrame>
  )
}
