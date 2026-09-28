/**
 * The shared UNIFIED EDIT LANGUAGE vocabulary — the single editing cue — kept
 * beside {@link SheetSection} but in its own module so the section components
 * stay in a components-only file.
 */

/**
 * The ONE editing cue (redesign rule): a dashed outline in the sheet's deep
 * tone, shown ON DEMAND — when the field is hovered or holds focus.
 *
 * Live-sheet fields are always editable (the section Edit toggle is gone), and
 * a permanent dashed outline on every field would draw the whole sheet in
 * dashes. Revealing it on approach says "this one is writable" at the moment
 * you ask, and `focus-within` keeps that promise for the keyboard, which has no
 * hover.
 *
 * The always-on variant this replaced is gone: its last consumer was the
 * standalone remove button, which is a red stamp now.
 */
export const EDIT_CUE_HOVER_CLASS =
  'outline-offset-2 outline-[color:var(--tone-deep,var(--color-rust))] hover:outline-dashed hover:outline-2 focus-within:outline-dashed focus-within:outline-2'
