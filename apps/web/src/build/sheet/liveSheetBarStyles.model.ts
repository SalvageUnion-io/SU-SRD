/**
 * The style objects of a sheet's condensed bar (`LiveSheet`): the sticky bar
 * that fades in once the band scrolls away, its name-and-vitals strip and its
 * end row. Its classes are `styles/build/sheet/bar.css`'s.
 */

import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'

/** Sticky bar height: one compact row. */
const BAR_HEIGHT_PX = 48

/**
 * The sticky bar's anchor: sticky at the top, but no height, so at rest the
 * page starts with the band and nothing above it.
 */
export const BAR_ANCHOR = {
  height: 0,
  position: 'sticky',
  top: 0,
  zIndex: tokens.layer.sticky,
} satisfies CSSProperties

/** The bar, over the page from its anchor. Its gutter (`.su-sheet-gutter`) widens at sm. */
const BAR = {
  alignItems: 'center',
  // The band in brief, in the unit's own paint.
  background: 'var(--su-kind, var(--color-wk-bg))',
  // No black rule under the app's nav: the lift alone
  // sets it off the page it floats over.
  boxShadow: tokens.shadow.lift,
  columnGap: tokens.space[16],
  // `display` is `.su-sheet-bar`'s, so paper's `data-print="hide"` passes it.
  flexWrap: 'wrap',
  insetInline: 0,
  minHeight: `${BAR_HEIGHT_PX}px`,
  paddingBlock: tokens.space[4],
  position: 'absolute',
  rowGap: tokens.space[4],
  top: 0,
  transitionDuration: 'var(--dur-fast)',
  transitionProperty: 'opacity, visibility, translate',
  transitionTimingFunction: tokens.ease,
} satisfies CSSProperties

/** Scrolled past the sentinel: the bar fades in. */
export const BAR_SHOWN = {
  ...BAR,
  opacity: 1,
  translate: '0 0',
  visibility: 'visible',
} satisfies CSSProperties

/** At rest it is not there to see, click or read. */
export const BAR_HIDDEN = {
  ...BAR,
  opacity: 0,
  pointerEvents: 'none',
  translate: '0 -100%',
  visibility: 'hidden',
} satisfies CSSProperties

/**
 * A row of the bar that pans inside the bar when it is wider than the screen
 * (r4 E7): a pilot's name and vitals, or its mode buttons and linked units,
 * once made the whole page 500px wide on a 390px phone.
 */
const PANS = {
  maxWidth: '100%',
  minWidth: 0,
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  scrollbarWidth: 'none',
} satisfies CSSProperties

const STRIP = {
  ...PANS,
  alignItems: 'stretch',
  display: 'flex',
  flexWrap: 'nowrap',
  gap: tokens.space[8],
  transitionDuration: 'var(--dur-base)',
  transitionProperty: 'opacity, transform',
  transitionTimingFunction: tokens.ease,
} satisfies CSSProperties

export const STRIP_SHOWN = { ...STRIP, opacity: 1, translate: '0 0' } satisfies CSSProperties

// At rest it is out of the flow as well as invisible: an invisible strip
// still took the bar's first row on a phone, pushing Share and ⋯ down.
export const STRIP_HIDDEN = {
  ...STRIP,
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  translate: '0 5px',
  visibility: 'hidden',
} satisfies CSSProperties

export const BAR_END = {
  ...PANS,
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  flexWrap: 'nowrap',
  gap: tokens.space[8],
  marginLeft: 'auto',
} satisfies CSSProperties
