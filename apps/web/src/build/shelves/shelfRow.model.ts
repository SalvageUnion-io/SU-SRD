/**
 * Bringing a shelf's new line into view: a copy lands wherever the shelf's
 * sort puts it, which on a long shelf is off the screen, so the act would
 * otherwise show nothing.
 */
import type { EntityKind } from 'game-domain/entityKinds'

/** The line of the unit just made: the table row its name's link stands in. */
function rowOf(type: EntityKind, id: string): Element | null {
  const path = ['', `${type}s`, id].join('/')
  for (const link of document.getElementsByTagName('a'))
    if (link.getAttribute('href')?.endsWith(path)) return link.closest('tr')
  return null
}

/** Scroll the unit's line into view once the shelf has drawn it. */
export function showShelfRow(
  type: EntityKind,
  id: string,
  frame: (run: () => void) => void = (run) => requestAnimationFrame(() => run())
): void {
  // Two frames: the store's write, then the shelf's paint of it.
  frame(() => frame(() => rowOf(type, id)?.scrollIntoView({ block: 'nearest' })))
}
