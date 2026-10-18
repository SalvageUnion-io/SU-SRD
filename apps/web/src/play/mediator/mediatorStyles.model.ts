/**
 * The Mediator's shared text styles (play.md §10): the muted copy and the
 * lined-up numbers inside the propose dock and the proposals list.
 *
 * Style objects over `tokens` only: no stylesheet class (ADR-046).
 */

import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'

const { color, font, fontSize } = tokens

/** Body copy inside a box. */
const BODY = {
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.45,
  color: color.ink,
} satisfies CSSProperties

export const MUTED = { ...BODY, color: color.ink75 } satisfies CSSProperties

/** Numbers line up. */
export const NUMBERS = { fontVariantNumeric: 'tabular-nums' } satisfies CSSProperties
