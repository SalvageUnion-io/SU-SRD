/**
 * The shared UNIFIED EDIT LANGUAGE vocabulary — the single editing cue and the
 * per-card remove/swap control factory — kept beside {@link SheetSection} but in
 * its own module so the section components stay in a components-only file (this
 * module exports only constants + a factory, which is why the glyph adapters are
 * inlined as the controls' `icon` render functions rather than declared as
 * top-level components).
 */

import { Glyph } from '../chrome/glyphs'
import { cn } from '../../utils/cn'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'

/**
 * The ONE editing cue (redesign rule): dashed outline in the sheet's deep
 * tone on anything that is currently editable via a section Edit or a
 * per-card control.
 */
export const EDIT_CUE_CLASS =
  'outline-dashed outline-2 outline-offset-2 outline-[color:var(--tone-deep,var(--color-rust))]'

/**
 * Card `cardStyle` override that stamps the editing cue onto a removable
 * entity card (redesign G4: the cue moves from the per-card control BUTTON onto
 * the CARD). Includes `shadow-lg` because Card's `cardStyle.className`
 * REPLACES the default shadow.
 */
export const REMOVABLE_CARD_STYLE: { className: string } = {
  className: cn('shadow-lg', EDIT_CUE_CLASS),
}

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
  })
  return controls
}
