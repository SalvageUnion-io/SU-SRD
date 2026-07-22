import type { KeyboardEvent } from 'react'

/**
 * Shared interaction primitives for the chrome atoms — one source of truth for
 * the focus ring, disabled treatment, selection ring, and keyboard activation
 * that Button / StepButton / Sel would otherwise each re-inline.
 */

/** The canonical rust focus ring (design-spec §2.4). */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25'

/**
 * The same rust ring for text inputs (design-spec §2.5), on plain `focus:` —
 * an editable control shows the ring on every focus, not just keyboard focus.
 */
export const INPUT_FOCUS = 'focus:outline-none focus:ring-[3px] focus:ring-rust/25'

/**
 * The same rust ring again, raised by a focusable DESCENDANT — the search-field
 * shape, where the bordered shell is the thing that should look focused but the
 * `<input>` inside is what actually takes focus. The inner control carries
 * `focus:outline-none` itself, so this is ring-only: there is no outline on the
 * shell to suppress, and pretending otherwise would imply the shell is
 * focusable when it is not.
 *
 * This third rung exists because both search shells had already invented it —
 * one as a pilot OUTLINE, one as the rust ring inline — which is the usual
 * signal that the vocabulary was missing a word, not that the surfaces were
 * special.
 */
export const FOCUS_WITHIN = 'focus-within:ring-[3px] focus-within:ring-rust/25'

/**
 * The ON-TONE rung: an ink ring with a paper offset, for a focusable surface
 * whose own background is an arbitrary ENTITY TONE rather than paper — a
 * clickable entity card can be pale pilot or near-black `tl-6`, and the 25%-alpha
 * rust ring simply disappears against the dark end of that ramp.
 *
 * This is a real exception, not drift, so it is named instead of inlined: the
 * ring is the accessibility affordance, and a rung that vanishes on a legal
 * background is not one. Reach for it ONLY when the background is caller-supplied
 * tone; everything sitting on paper uses `FOCUS_RING`.
 */
export const FOCUS_RING_ON_TONE =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper'

/** The canonical disabled treatment (opacity + no pointer events). */
export const DISABLED = 'disabled:pointer-events-none disabled:opacity-40'

/** Non-layout-shifting 3px rust selection ring (design-spec §2.8). */
export const SELECTION_RING = 'shadow-[0_0_0_3px_var(--color-rust)]'

/**
 * Double-ink "halo" selection ring — a ground gap then a 3px ink ring, the
 * emphasis the onboarding doors / custom-build door use instead of the rust
 * ring. Opt in via `Sel`'s `ring="ink-double"`.
 */
export const SELECTION_RING_INK_DOUBLE =
  'shadow-[0_0_0_3px_var(--ground),0_0_0_6px_var(--color-ink)]'

/**
 * Enter/Space → activate, matching native button semantics on a `div` wrapper
 * that carries `role="button"`/`"radio"`. Returns a handler that no-ops when
 * `onActivate` is absent, so callers can pass an optional toggle directly.
 */
export function activateOnKey(onActivate?: () => void) {
  return (e: KeyboardEvent) => {
    if (onActivate && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onActivate()
    }
  }
}
