import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * A search field is full width on a phone: every
 * visible `SearchField` (`.su-search-field`) spans its line, edge to edge:
 * the content box of the outermost row it sits in (a search among tools must
 * fill the tools' whole row, on its own line), or, in no row, of its parent
 * (past any `display: contents` box). Returns one line per field that falls short; a
 * spec asserts none.
 */
export async function findSearchWidths(page: Page): Promise<Finding[]> {
  const faults = await page.evaluate(() => {
    const row = (el: Element | null) => {
      if (!el) return false
      const cs = getComputedStyle(el)
      return /flex/.test(cs.display) && !cs.flexDirection.startsWith('column')
    }
    const faults: string[] = []
    for (const field of document.querySelectorAll<HTMLElement>('.su-search-field')) {
      const r = field.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // The line: the outermost row of the rows the field sits in (a
      // field among tools fills the tools' row), else its own box's parent.
      let column: Element | null = null
      let at = field.parentElement
      while (at && getComputedStyle(at).display === 'contents') at = at.parentElement
      column = at
      while (at && (row(at) || row(at.parentElement))) {
        if (row(at)) column = at
        at = at.parentElement
      }
      if (!column) continue
      const c = column.getBoundingClientRect()
      const cs = getComputedStyle(column)
      const left =
        c.left + Number.parseFloat(cs.borderLeftWidth) + Number.parseFloat(cs.paddingLeft)
      const right =
        c.right - Number.parseFloat(cs.borderRightWidth) - Number.parseFloat(cs.paddingRight)
      if (r.left - left > 1 || right - r.right > 1) {
        const input = field.querySelector('input')
        const name = input?.getAttribute('aria-label') ?? input?.placeholder ?? 'a search'
        faults.push(
          `"${name}" is ${Math.round(r.width)}px of its ${Math.round(right - left)}px line`
        )
      }
    }
    return faults
  })
  return fromFaults(faults, 'width')
}
