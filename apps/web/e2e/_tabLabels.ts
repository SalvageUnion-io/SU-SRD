import type { Page } from '@playwright/test'

/**
 * Hard rule R29, "Tabs, Segmented, Toggle by job" (chrome K10, EDL E18), on the
 * rendered page: no tab or segment label overflows.
 *
 * A label is every `Tab` (`[role="tab"]`), every `SegmentedOption`
 * (`.su-seg__option`) and the Union bar's Reference | Build | Play
 * (`.su-union-bar__tab`). Each one shown must:
 *
 * - `cut`: hold its whole label, never clip it or end it in "…": its content
 *   is no wider than its box (`scrollWidth`), and nothing in it ellipsizes;
 * - `hidden`: sit inside its row's visible box and the viewport, never
 *   scrolled or pushed out of sight (a row of many options wraps: Segmented's
 *   `wrap`).
 *
 * The source half of R29 (one role per component) is `controls/tab-role` and
 * `controls/pressed` (`bun run check styling`).
 */
const LABELS = '[role="tab"], .su-seg__option, .su-union-bar__tab'

/** Every shown tab or segment label on the page that does not fit, by rule. */
export async function findTabLabelFaults(page: Page): Promise<{ rule: string; line: string }[]> {
  return await page.evaluate((selector) => {
    const out: { rule: string; line: string }[] = []
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const name = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
    for (const el of document.querySelectorAll(selector)) {
      if (!(el instanceof HTMLElement) || !shown(el)) continue
      const label = `"${name(el) || el.getAttribute('aria-label') || '?'}"`
      const ellipsized = [el, ...el.querySelectorAll('*')].some((n) => {
        const s = getComputedStyle(n)
        return (
          s.textOverflow === 'ellipsis' &&
          (n as HTMLElement).scrollWidth > (n as HTMLElement).clientWidth + 1
        )
      })
      if (el.scrollWidth > el.clientWidth + 1 || ellipsized) {
        out.push({
          rule: 'cut',
          line: `${label} is cut: ${el.scrollWidth}px of label in ${el.clientWidth}px`,
        })
        continue
      }
      const box = el.getBoundingClientRect()
      const row = el.closest('[role="tablist"], .su-seg, nav')
      const rowBox = row?.getBoundingClientRect()
      const outOfRow =
        rowBox !== undefined && (box.left < rowBox.left - 1 || box.right > rowBox.right + 1)
      const outOfView = box.left < -1 || box.right > window.innerWidth + 1
      if (outOfRow || outOfView) {
        out.push({
          rule: 'hidden',
          line: `${label} sits outside its ${outOfView ? 'viewport' : 'row'}`,
        })
      }
    }
    return out
  }, LABELS)
}

/** How many labels the page has, so a walk that read none fails. */
export async function countTabLabels(page: Page): Promise<number> {
  return await page.locator(LABELS).count()
}
