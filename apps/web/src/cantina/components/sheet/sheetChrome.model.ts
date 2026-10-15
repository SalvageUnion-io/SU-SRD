import type { CSSProperties } from 'react'
import { tokens } from '../../../ui/index'

/**
 * Shared app-bar chrome constants (design source clean-pilot.html `.appbar`).
 * Kept in its own module (not LiveSheet.tsx) so component files only export
 * components — required for React Fast Refresh.
 */

/** The caution banner over a sheet the reader cannot edit (public, or a crewmate's). */
export const READ_ONLY_BANNER = {
  backgroundColor: tokens.color.caution,
  borderBottom: `${tokens.borderWidth.pill} solid ${tokens.color.ink}`,
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  fontWeight: tokens.weight.semibold,
  lineHeight: 'calc(1.25 / 0.875)',
  paddingBlock: tokens.space[8],
} satisfies CSSProperties
