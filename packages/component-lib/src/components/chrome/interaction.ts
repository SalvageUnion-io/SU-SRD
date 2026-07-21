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
