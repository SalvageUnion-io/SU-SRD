/**
 * StampSeam — the border-riding placement (ruleset §5 technique, §7.2).
 *
 * The signature move: an ink Stamp centred on a container's border line, half
 * above / half over, like a label plate riveted across a seam. The vertical
 * offset derives from the stamp's **own height** (`translate: 0 -50%`), never a
 * fixed margin, so it never drifts as the text grows.
 *
 * The `.su-stamp-seam` rule in `styles/index.css`; a class-string export, so
 * stylesheet-only, and the class name is public API.
 *
 * Usage: give the container `relative`, then place the stamp with
 * `className={cn(STAMP_SEAM, 'left-3')}` (the horizontal inset is the caller's).
 *
 * Rides: bordered value wells, card callouts, tooltip titles, and (to save
 * space) a Badge / horizontal-stat edge label. Does NOT ride the Slab leader or
 * a flush header band (`band ≠ rider`).
 */
export const STAMP_SEAM = 'su-stamp-seam'
