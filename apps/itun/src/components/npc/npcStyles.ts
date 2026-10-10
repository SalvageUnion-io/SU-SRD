/**
 * The NPC designer's static geometry and type (boards N1 and N2), as style
 * objects (tailwind-removal.md §4). Responsive rules — the step strip and the
 * phone preview — are classes in `styles/npc.css`, because a style object has
 * no media query.
 */

import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'

export const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100%',
  paddingBottom: tokens.space[48],
} satisfies CSSProperties

/** Two columns where there is room for them; one, stacked, where there is not. */
export const COLUMNS = {
  alignItems: 'start',
  display: 'grid',
  gap: tokens.space[32],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
  margin: '0 auto',
  maxWidth: '80rem',
  padding: `${tokens.space[16]} ${tokens.space[16]} 0`,
} satisfies CSSProperties

export const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

/** Condensed caps over a field or a region ("LIVE PREVIEW · …", "TEMPLATE"). */
export const CAPS = {
  color: tokens.color.ink,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsSnug,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The band's eyebrow on a chapter colour that carries paper text. */
export const EYEBROW = {
  ...CAPS,
  color: tokens.color.paper,
  fontSize: tokens.fontSize.caption,
} satisfies CSSProperties

/** The pencil look of a field the player writes (ruleset §1, the edit field). */
export const PENCIL = { borderStyle: 'dashed' } satisfies CSSProperties

export const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

export const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** A dashed note: the rule, said once where the player is about to make something. */
export const NOTE = {
  borderColor: tokens.color.ink,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: 0,
  padding: tokens.space[12],
} satisfies CSSProperties

export const HINT = {
  color: tokens.color.ink2,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: 0,
} satisfies CSSProperties

/** A visually hidden live region (the Roll announcement). */
export const VISUALLY_HIDDEN = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
} satisfies CSSProperties
