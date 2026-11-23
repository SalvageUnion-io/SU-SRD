import type { CSSProperties, ReactNode } from 'react'
import { createContext } from 'react'
import { tokens } from '../../components/index'

/**
 * The read-only banner's style object, shared by `SheetView` and
 * `PublicSheet`. Kept out of the component files so they export only
 * components (React Fast Refresh).
 */

/** The caution banner over a sheet the reader cannot edit (public, or a crewmate's). */
export const READ_ONLY_BANNER = {
  backgroundColor: tokens.color.caution,
  borderBottom: `${tokens.borderWidth.pill} solid ${tokens.color.ink}`,
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  fontWeight: tokens.weight.semibold,
  lineHeight: 'calc(1.25 / 0.875)',
  paddingBlock: tokens.space[8],
} satisfies CSSProperties

/**
 * A public sheet's read-only banner (r7 G1), drawn by `LiveSheet` under its
 * chapter band in the page flow at every width: above it, the desktop band,
 * which runs up behind the area rail, covered the banner and took its clicks.
 */
export const SheetBannerContext = createContext<ReactNode>(null)
