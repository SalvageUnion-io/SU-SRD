/** EntitySearcher's static styles and its one width query. */

import type { CSSProperties } from 'react'
import { color, fontSize, space, widthAtLeast } from '../../design/tokens'
import { capsLabel } from '../atoms/capsLabel'

/**
 * The width at which the picker becomes three columns. Mirrors the
 * `.su-searcher` media query in styles/partials/controls.css — change both or
 * neither. CSS owns the LAYOUT; this only decides what the parts ARE at that
 * width: the rail a column or a bar, the Tech level chips inline or folded,
 * and whether an opened Mini takes the picker over.
 */
export const WIDE_QUERY = widthAtLeast('lg')

// Static properties only — every property that changes with the breakpoint
// lives in the `.su-searcher*` classes (the split rule).

/** The body shrinks with the frame's cap (`.su-searcher-panel`), so the
 * searcher under the head takes what is left and scrolls in it. */
export const BODY_STYLE = { minHeight: 0 } satisfies CSSProperties

/** In a host's frame, the searcher fills its body as its own frame's would. */
export const HOSTED_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
} satisfies CSSProperties

/** The subtitle: a line of the paper under the cut-out, as ModalShell's. */
export const SUBTITLE_STYLE = {
  margin: 0,
  padding: `${space[12]} ${space[16]} 0`,
  fontSize: fontSize.chip,
  lineHeight: 1.2,
  color: color.wkMuted, // design-tokens-ignore(muted-note): the dialog subtitle, in caps
} satisfies CSSProperties
export const SUBTITLE_CAPS = capsLabel()

export const LIST_SCROLL_STYLE = {
  padding: `${space[12]} ${space[16]} ${space[16]}`,
} satisfies CSSProperties
export const SUMMARY_ROW_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
  margin: `0 0 ${space[8]}`,
} satisfies CSSProperties
export const SUMMARY_STYLE = {
  margin: 0,
  color: color.wkMuted,
} satisfies CSSProperties
/** A row's "Above Tech N" tag: beside the Mini, never shrinking or taking its press. */
export const ROW_TAG_STYLE = {
  alignSelf: 'center',
  flex: 'none',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
export const SUMMARY_CAPS = capsLabel({ size: 'badge' })
