import { cn } from '../../utils/cn'
import { buttonVariants } from '../chrome/buttonVariants'

/**
 * Shared app-bar chrome constants (design source clean-pilot.html `.appbar`).
 * Kept in its own module (not LiveSheet.tsx) so component files only export
 * components — required for React Fast Refresh.
 */

/**
 * App-bar icon button (poster `.iconbtn`, clean-pilot.html:117-129): a 38px
 * bordered square. Shared by LiveSheet's back button and SheetActionsMenu's
 * "⋯" overflow trigger so the bar's two icon buttons can never drift apart.
 *
 * Built ON `buttonVariants` rather than re-inlining its class string — that
 * recipe is exported precisely for non-`<button>` elements, and one of these
 * two consumers is a link. Restating it by hand meant every Button change
 * (focus ring, disabled state, radius) silently skipped the app bar. Only the
 * square 38px geometry is layered on top.
 */
export const SHEET_ICONBTN_CLASS = cn(
  buttonVariants({ variant: 'default' }),
  'size-[38px] shrink-0 p-0'
)
