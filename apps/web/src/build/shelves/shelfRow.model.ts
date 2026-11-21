/**
 * Bringing a shelf's new line into view: a copy lands wherever the shelf's
 * sort puts it, which on a long shelf is off the screen, so the act would
 * otherwise show nothing.
 */
import type { EntityKind } from 'game-domain/entityKinds'

/** The line of the unit just made, found by its name's link. */
const rowOf = (type: EntityKind, id: string): Element | null =>
  document.querySelector(`.su-shelf-ledger tbody a[href$="/${type}s/${id}"]`)?.closest('tr') ?? null

/** Scroll the unit's line into view once the shelf has drawn it. */
export function showShelfRow(
  type: EntityKind,
  id: string,
  frame: (run: () => void) => void = (run) => requestAnimationFrame(() => run())
): void {
  // Two frames: the store's write, then the shelf's paint of it.
  frame(() => frame(() => rowOf(type, id)?.scrollIntoView({ block: 'nearest' })))
}
