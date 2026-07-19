/**
 * Shared app-bar chrome constants (design source clean-pilot.html `.appbar`).
 * Kept in its own module (not LiveSheet.tsx) so component files only export
 * components — required for React Fast Refresh.
 */

/**
 * App-bar icon button (poster `.iconbtn`, clean-pilot.html:117-129): a 38px
 * bordered square. Shared by LiveSheet's back button and SheetActionsMenu's
 * "⋯" overflow trigger so the bar's two icon buttons can never drift apart.
 */
export const SHEET_ICONBTN_CLASS =
  'flex size-[38px] shrink-0 items-center justify-center rounded-card border-chrome border-ink bg-paper text-ink transition-colors duration-[120ms] hover:bg-wk-bg-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25'
