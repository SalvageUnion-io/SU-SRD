/**
 * StampSeam — the border-riding placement (ruleset §5 technique, §7.2).
 *
 * The signature move: an ink Stamp centred on a container's border line, half
 * above / half over, like a label plate riveted across a seam. The vertical
 * offset derives from the stamp's **own height** (`translate: 0 -50%`), never a
 * fixed margin, so it never drifts as the text grows.
 *
 * The `.su-stamp-seam` rule lives in `styles/partials/atoms.css`. The class
 * string is library-internal (Field, Badge); it is not exported from the
 * package.
 *
 * Usage: give the container `position: relative`, then place the stamp with
 * `className={STAMP_SEAM}` and the horizontal inset as a style object
 * (`style={{ left: space[8] }}`, as Field's `LABEL_SEAT` does).
 *
 * Rides: bordered value wells, card callouts, tooltip titles, and (to save
 * space) a Badge / horizontal-stat edge label. Does NOT ride the Slab leader or
 * a flush header band (`band ≠ rider`).
 */
export const STAMP_SEAM = 'su-stamp-seam'
