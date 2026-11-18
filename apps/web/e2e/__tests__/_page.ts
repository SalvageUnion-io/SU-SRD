import type { Page } from '@playwright/test'

/**
 * A page for a scanner's reader under happy-dom: `evaluate` runs the reader
 * on this document. happy-dom lays nothing out, so each element's box is the
 * one its `data-box` gives (`left,top,width,height`), 100 by 20 at the origin
 * without one.
 *
 * Returns the page and the restore; call it in an `afterAll`.
 */
export function documentPage(): { page: Page; restore: () => void } {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const [left = 0, top = 0, width = 100, height = 20] = (this.getAttribute('data-box') ?? '')
      .split(',')
      .filter((part) => part !== '')
      .map(Number)
    return new DOMRect(left, top, width, height)
  }
  const page = { evaluate: async (read: () => unknown) => read() } as unknown as Page
  return {
    page,
    restore: () => {
      Element.prototype.getBoundingClientRect = original
      // The document is shared with every later file in the run: leave it empty.
      document.body.innerHTML = ''
    },
  }
}
