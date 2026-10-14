import { buttonVariants, cn, tokens } from 'component-lib'
import type { CSSProperties } from 'react'

/**
 * Shared app-bar chrome constants (design source clean-pilot.html `.appbar`).
 * Kept in its own module (not LiveSheet.tsx) so component files only export
 * components — required for React Fast Refresh.
 */

/**
 * App-bar icon button (poster `.iconbtn`, clean-pilot.html:117-129): a
 * bordered square at the page-top control height (`.su-page-action`). Shared by LiveSheet's back button and SheetActionsMenu's
 * "⋯" overflow trigger so the bar's two icon buttons can never drift apart.
 *
 * Built ON `buttonVariants` rather than re-inlining its class string — that
 * recipe is exported precisely for non-`<button>` elements, and one of these
 * two consumers is a link. Restating it by hand meant every Button change
 * (focus ring, disabled state, radius) silently skipped the app bar. Only the
 * square geometry is layered on top: the icon rung at `.su-page-action`'s
 * height, which the library squares to 40px. HeaderMenu's overflow "⋯" is the
 * same button.
 */
export const SHEET_ICONBTN_CLASS = cn(
  buttonVariants({ variant: 'default', size: 'iconOnly' }),
  'su-page-action'
)

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
