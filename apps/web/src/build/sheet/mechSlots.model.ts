/**
 * A mech's slot counts as its sheet says them (`MechDash`, the pickers'
 * budgets): the `SLOTS | used/max` chip, and whether an over-slot count is
 * the book's own ("as printed", `computeMechCapacity`'s `asPrinted`).
 */

import type { SlabCount } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

/** The book's pattern behind an over-slot loadout (`computeMechCapacity`'s `asPrinted`). */
export type AsPrinted =
  | { pattern: string; cite: string; systems: boolean; modules: boolean }
  | undefined

/** The loadout's two lines, each judged on its own (r4 E16). */
export type SlotLine = 'systems' | 'modules'

/**
 * An over-slot count is "as printed" when its line is a pattern's the book
 * prints over its chassis's slots: the count is the book's, not a mistake.
 * Each line is its own: editing the Modules leaves the Systems as printed.
 */
export function overAsPrinted(
  used: number,
  max: number,
  asPrinted: AsPrinted,
  line: SlotLine
): boolean {
  return asPrinted?.[line] === true && used > max
}

/** A line over its slots that is not the book's own: the rule-breaking count. */
export function overSlots(used: number, max: number, asPrinted: AsPrinted, line: SlotLine) {
  return used > max && asPrinted?.[line] !== true
}

/**
 * A section's `SLOTS | used/max` chip, noted "as printed" (with its cite) when
 * an over-slot count is the book's; any other over-slot count is critical.
 */
export function slotCount(
  used: number,
  max: number,
  asPrinted: AsPrinted,
  line: SlotLine
): SlabCount {
  const printed = overAsPrinted(used, max, asPrinted, line) ? asPrinted : undefined
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
