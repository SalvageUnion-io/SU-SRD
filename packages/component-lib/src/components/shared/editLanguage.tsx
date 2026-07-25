/**
 * The shared UNIFIED EDIT LANGUAGE vocabulary — the single editing cue and the
 * per-card remove/swap control factory — kept beside {@link SheetSection} but in
 * its own module so the section components stay in a components-only file (this
 * module exports only constants + a factory, which is why the glyph adapters are
 * inlined as the controls' `icon` render functions rather than declared as
 * top-level components).
 */

import { Glyph } from '../chrome/glyphs'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'

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

type CardControlOptions = {
  /** Entity name for the accessible labels ("Remove {name}" / "Swap {name}"). */
  name: string
  onRemove: () => void
  /**
   * Optional single-select-replace swap. When provided a ⇄ control renders
   * before ✕. Deferred for most collections in Phase 1B (no replace handler
   * wired yet); ✕-only until then.
   */
  onSwap?: () => void
}

/**
 * Build the Card `controls` array for a removable entity card. Icon-only
 * controls (`icon` + no `label`) render as 28/32px squares by ControlButtons.
 * The ⇄/✕ glyphs are inlined here (the shared {@link Glyph} set), since
 * `icon` takes a render function rather than a glyph name.
 */
export function cardRemoveControls({
  name,
  onRemove,
  onSwap,
}: CardControlOptions): ReferenceEntityControl[] {
  const controls: ReferenceEntityControl[] = []
  if (onSwap) {
    controls.push({
      key: 'swap',
      ariaLabel: `Swap ${name}`,
      icon: (props) => <Glyph name="swap" {...props} />,
      onClick: onSwap,
    })
  }
  controls.push({
    key: 'remove',
    ariaLabel: `Remove ${name}`,
    icon: (props) => <Glyph name="remove" {...props} />,
    onClick: onRemove,
    // A red STAMP, not neutral chrome: this is the one control in the rail that
    // destroys something, and in paper-and-ink it read like the fold chevron
    // sitting next to it.
    variant: 'danger',
  })
  return controls
}
