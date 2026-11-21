/**
 * A mech's slot counts as its sheet says them (`MechDash`, the pickers'
 * budgets): the `SLOTS | used/max` chip, and whether an over-slot count is
 * the book's own ("as printed", `computeMechCapacity`'s `asPrinted`).
 */

import type { SlabCount } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

/** The book's pattern behind an over-slot loadout (`computeMechCapacity`'s `asPrinted`). */
export type AsPrinted = { pattern: string; cite: string } | undefined

/**
 * An over-slot count is "as printed" when the loadout is a pattern the book
 * prints over its chassis's slots: the count is the book's, not a mistake.
 */
export function overAsPrinted(used: number, max: number, asPrinted: AsPrinted): boolean {
  return asPrinted !== undefined && used > max
}

/**
 * A section's `SLOTS | used/max` chip, noted "as printed" (with its cite) when
 * an over-slot count is the book's; any other over-slot count is critical.
 */
export function slotCount(used: number, max: number, asPrinted: AsPrinted): SlabCount {
  const printed = overAsPrinted(used, max, asPrinted) ? asPrinted : undefined
  if (printed) {
    return {
      label: buildSheetCopy('slots'),
      value: used,
      max,
      note: buildSheetCopy('asPrinted'),
      title: `${printed.pattern}, ${printed.cite}`,
    }
  }
  return {
    label: buildSheetCopy('slots'),
    value: used,
    max,
    ...(used > max ? { state: 'critical' } : {}),
  }
}
