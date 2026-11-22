/**
 * Where a Peek stands (PT4-04, r4 E6). A chip that left its head is not
 * drawn there (`data-fill-out`, `chipFill.ts`): its copy in the body's first
 * row presses it, so the press arrives from a node with no box, and the popup
 * once drew at the screen's top-left. The copy the reader pressed is the
 * anchor: the same Peek, with the same words, in the head's overflow row.
 *
 * Read off the DOM here, in the Peek's own lazy code, so the fill's page-load
 * script carries nothing for it.
 */
export function drawnAnchor(pressed: HTMLElement): HTMLElement {
  const out = pressed.closest('[data-fill-out]')
  if (!out) return pressed
  const row = out.closest('[data-chip-overflow-owner]')?.nextElementSibling
  if (!(row instanceof HTMLElement) || !row.hasAttribute('data-chip-overflow')) return pressed
  const address = pressed.getAttribute('data-peek')
  const twin = [...row.querySelectorAll<HTMLElement>('[data-peek]')].find(
    (el) => el.getAttribute('data-peek') === address && el.textContent === pressed.textContent
  )
  return twin ?? pressed
}
