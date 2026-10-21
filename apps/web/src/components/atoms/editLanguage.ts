/**
 * The live sheets' shared edit vocabulary: the single editing cue.
 */

/**
 * The ONE editing cue (redesign rule): a dashed outline in the sheet's deep
 * tone, shown ON DEMAND — when the field is hovered.
 *
 * Live-sheet fields are always editable (the section Edit toggle is gone), and
 * a permanent dashed outline on every field would draw the whole sheet in
 * dashes. Revealing it on approach says "this one is writable" at the moment
 * you ask. The keyboard, which has no hover, gets the field's focus ring:
 * focus is the ring's alone (chrome.md K9), never a dashed variant.
 *
 * The always-on variant this replaced is gone: its last consumer was the
 * standalone remove button, which is a red stamp now.
 */
export const EDIT_CUE_HOVER_CLASS = 'su-edit-cue'
