import type { KeyboardEvent } from 'react'

/**
 * Shared interaction primitives for the chrome atoms — one source of truth for
 * the focus ring, disabled treatment and keyboard activation
 * that Button / StepButton would otherwise each re-inline.
 *
 * ## These are `.su-*` class NAMES
 *
 * Each is a string you drop into `className`: it composes through `cn()` and
 * works on any element, in this package or in either app. The rules live in
 * `src/styles/index.css`.
 *
 * They are stylesheet-only because a consuming app puts them on elements the
 * library never renders, and a string constant cannot carry a style object —
 * the class-string exemption in `.claude/rules/styling.md`.
 *
 * **The names are public API.** Apps compose them with `cn()`, so they land in
 * app-side code and cannot be renamed cheaply. Treat a new one as a commitment.
 */

/**
 * The canonical focus ring (design-spec §2.4): a paper offset under an ink ring.
 * It was rust until the rust allowlist (ruleset §3.1) — rust is painted only by
 * an action, and a focused field or card is not one.
 */
export const FOCUS_RING = 'su-focus-ring'

/**
 * The same ring for text inputs (design-spec §2.5), on plain `focus:` —
 * an editable control shows the ring on every focus, not just keyboard focus.
 */
export const INPUT_FOCUS = 'su-input-focus'

/**
 * The same ring again, raised by a focusable DESCENDANT — the search-field
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

/** The canonical disabled treatment (opacity + no pointer events). */
export const DISABLED = 'su-disabled'

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
