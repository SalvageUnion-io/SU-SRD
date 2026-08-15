import type { KeyboardEvent } from 'react'

/**
 * Shared interaction primitives for the chrome atoms — one source of truth for
 * the focus ring, disabled treatment, selection ring, and keyboard activation
 * that Button / StepButton / Sel would otherwise each re-inline.
 *
 * ## These are `.su-*` class NAMES now, not Tailwind class strings (#799, #802)
 *
 * The SHAPE is unchanged — each is still a string you drop into `className`,
 * still composes through `cn()`, still works on any element — so no call site
 * moves, in this package or in either app. What changed is where the rules
 * live: `src/styles/index.css`, rather than Tailwind's generated utilities.
 *
 * **Why these do not get the split rule's style-object half.** That half
 * assumes the library owns the element being styled. These deliberately do not:
 * they exist so a consuming app can put the treatment on an element the library
 * never renders, which is the whole reason they are exported. A constant
 * holding a string cannot carry a style object without changing its type, and
 * its type is public API. So they were always going to be stylesheet-only the
 * moment Tailwind left — a class name is the only thing they can carry. The
 * category is written up in this package's CLAUDE.md as the split rule's
 * BOUNDARY, not an exception to it.
 *
 * **The names are public API.** Apps compose them with `cn()`, so they land in
 * app-side code and cannot be renamed cheaply. Treat a new one as a commitment.
 */

/** The canonical rust focus ring (design-spec §2.4). */
export const FOCUS_RING = 'su-focus-ring'

/**
 * The same rust ring for text inputs (design-spec §2.5), on plain `focus:` —
 * an editable control shows the ring on every focus, not just keyboard focus.
 */
export const INPUT_FOCUS = 'su-input-focus'

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
export const FOCUS_WITHIN = 'su-focus-within'

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
export const FOCUS_RING_ON_TONE = 'su-focus-ring-on-tone'

/** The canonical disabled treatment (opacity + no pointer events). */
export const DISABLED = 'su-disabled'

/** Non-layout-shifting 3px rust selection ring (design-spec §2.8). */
export const SELECTION_RING = 'su-selection-ring'

/**
 * Double-ink "halo" selection ring — a ground gap then a 3px ink ring, the
 * emphasis the onboarding doors / custom-build door use instead of the rust
 * ring. Opt in via `Sel`'s `ring="ink-double"`.
 */
export const SELECTION_RING_INK_DOUBLE = 'su-selection-ring-ink-double'

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
