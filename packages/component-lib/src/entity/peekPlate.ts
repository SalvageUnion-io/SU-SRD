import type { CSSProperties } from 'react'

/**
 * The PLATE the Peek's card is lifted on (board E3): a hard ink offset, no
 * blur — a drop-shadow, not a box-shadow, so it follows the card, not the
 * room. The seam stamp rides above the frame, so the plate keeps room at its
 * top; it is never wider than the room beside its trigger or the screen.
 */
export const PEEK_PLATE: CSSProperties = {
  filter: 'drop-shadow(4px 4px 0 var(--color-ink))',
  maxWidth: 'min(500px, calc(100vw - 16px), calc(var(--available-width, 100vw) - 4px))',
  paddingTop: 'var(--space-12)',
}
