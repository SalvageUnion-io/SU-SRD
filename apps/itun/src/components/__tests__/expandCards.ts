/**
 * expandCards — open every collapsed entity card in the current render.
 *
 * Live-sheet entity cards ship COLLAPSED (listing / `extent="head"`), so their
 * body — choices, uses counters, crew insets, the action foot — is not in the
 * DOM until the reader opens them. Tests that assert on body content call this
 * once after rendering; it is a no-op for any card that is already open.
 *
 * A folded card's one control is its chevron: a disclosure button named
 * "<entity> details" with `aria-expanded="false"`, the same affordance a
 * keyboard or screen-reader user activates. A pilot's equipment row folds
 * through its own "Expand <item>" disclosure, so both names count.
 */

import { act, fireEvent, screen } from '@testing-library/react'

/** Guard against a card that somehow re-renders folded — never spin forever. */
const MAX_PASSES = 5

export function expandCards(): void {
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const folded = screen.queryAllByRole('button', {
      name: /^Expand | details$/,
      expanded: false,
    })
    if (folded.length === 0) return
    act(() => {
      for (const card of folded) fireEvent.click(card)
    })
  }
}
