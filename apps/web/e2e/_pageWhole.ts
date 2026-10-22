import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * A reference page shows its whole self, at every width (hard rules R43,
 * R44): nothing in its content folds shut, a Live Sheet aside (`fold:`, a disclosure toggle, the
 * `useDisclosure` fold or a `<details>`; a Peek, a menu, a combobox and an
 * index's search rail aside), and the page never scrolls sideways
 * (`scroll:`, the document wider than the window).
 */

/** Runs in the page; returns plain data. */
function scanPageWhole(): string[] {
  const faults: string[] = []
  const root = document.scrollingElement ?? document.documentElement
  const across = root.scrollWidth - innerWidth
  if (across > 0) faults.push(`scroll: the page is ${across}px wider than the window`)
  const main = document.querySelector('main') ?? document.body
  // A Live Sheet folds its sections (R46); it is no reference page.
  if (main.matches('[data-variant]')) return faults
  const folds = main.querySelectorAll(
    'details, [aria-expanded][aria-controls]:not([aria-haspopup]):not([role="combobox"])'
  )
  for (const el of folds) {
    if (el.closest('.su-rail, [data-peek-popup], [aria-hidden="true"], [inert]')) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ')
    faults.push(`fold: "${name.slice(0, 40)}" folds the page's content`)
  }
  return faults
}

/** A fold in a reference page's content, and a page wider than its window. */
export async function findPageWhole(page: Page): Promise<Finding[]> {
  return fromFaults(await page.evaluate(scanPageWhole))
}
