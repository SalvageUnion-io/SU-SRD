import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { Finding } from './_findings'

/**
 * A sheet on the Play screen is laid out for its pane (play.md §18,
 * `styles/play/sheet.css`): the sheet's rungs ask the pane's width, never the
 * window's, which is wider than the pane at every desktop width.
 * `findSheetPaneLayout` reads the open pane (`.su-play-sheet`) and returns
 * each place it breaks:
 *
 * - `overflow`: the pane scrolls sideways.
 * - `covered`: the pane's own head (its × back to Actions) lies under the sheet.
 * - `overlap`: two regions of one of the sheet's layouts (the masthead, its
 *   vitals and lines, the dashboard's columns, the sheet's columns) are drawn
 *   over each other.
 * - `squeezed`: a masthead line (Motto, Keepsake, …) is a column too narrow to
 *   read, a word a line.
 */
const PANE = '.su-play-sheet'

/** The layouts whose children must not overlap. */
const LAYOUTS = [
  '.su-mast',
  '.su-strip__vitals',
  '.su-mast-traits',
  '.su-dash',
  '.su-sheet-columns',
]

/** A masthead line under this many px is a word a line. */
const LINE_FLOOR = 96

export async function findSheetPaneLayout(page: Page): Promise<Finding[]> {
  return await page.evaluate(
    ({ pane: paneSelector, layouts, floor }) => {
      const found: { rule: string; detail: string }[] = []
      const pane = document.querySelector<HTMLElement>(paneSelector)
      if (!pane) return [{ rule: 'missing', detail: 'missing: no sheet pane is open' }]
      const name = (el: Element) =>
        `.${[...el.classList].find((c) => c.startsWith('su-')) ?? el.tagName.toLowerCase()}`
      if (pane.scrollWidth > pane.clientWidth + 1)
        found.push({
          rule: 'overflow',
          detail: `overflow: the pane is ${pane.clientWidth}px and its sheet ${pane.scrollWidth}px`,
        })
      const close = pane.querySelector<HTMLElement>('[aria-label="Back to Actions"]')
      if (!close)
        found.push({ rule: 'covered', detail: 'covered: the pane has no × back to Actions' })
      for (const el of close ? [close] : []) {
        const r = el.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (top && !el.contains(top) && !top.contains(el))
          found.push({
            rule: 'covered',
            detail: `covered: the pane's head lies under ${name(top)}`,
          })
      }
      const drawn = (el: Element) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).position !== 'absolute'
      }
      for (const selector of layouts) {
        for (const layout of pane.querySelectorAll(selector)) {
          const kids = [...layout.children].filter(drawn)
          for (let i = 0; i < kids.length; i++) {
            for (let j = i + 1; j < kids.length; j++) {
              const a = kids[i]?.getBoundingClientRect()
              const b = kids[j]?.getBoundingClientRect()
              if (!a || !b) continue
              const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
              const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
              if (w > 1 && h > 1)
                found.push({
                  rule: 'overlap',
                  detail: `overlap: ${selector}'s ${name(kids[i] as Element)} and ${name(kids[j] as Element)} by ${Math.round(w)}×${Math.round(h)}px`,
                })
            }
          }
        }
      }
      for (const line of pane.querySelectorAll('.su-mast-trait')) {
        const { width } = line.getBoundingClientRect()
        if (width > 0 && width < floor)
          found.push({
            rule: 'squeezed',
            detail: `squeezed: a masthead line is ${Math.round(width)}px wide`,
          })
      }
      return found
    },
    { pane: PANE, layouts: LAYOUTS, floor: LINE_FLOOR }
  )
}

/**
 * Open every sheet the Play screen's pane may show (the first unit's Sheet
 * chip, then each line of "Show a sheet"), hand each to `read`, and go back to
 * Actions. Returns how many sheets it showed.
 */
export async function eachSheetInPane(
  page: Page,
  read: (sheet: string) => Promise<void>
): Promise<number> {
  const root = page.locator('.su-play-root')
  await root
    .getByRole('button', { name: /^Open .+ sheet$/ })
    .first()
    .click()
  const pane = page.locator(PANE)
  const sheet = pane.locator('main[data-variant]')
  await expect(sheet, 'the sheet pane opens').toBeVisible()
  const picker = pane.getByRole('button', { name: 'Show a sheet' })
  await picker.click()
  const lines = page.getByRole('menuitem')
  await expect(lines.first()).toBeVisible()
  const names = (await lines.allTextContents()).map((text) => text.split(',')[0]?.trim() ?? '')
  await page.keyboard.press('Escape')
  for (const [i, name] of names.entries()) {
    await picker.click()
    await lines.nth(i).click()
    await expect(
      pane.locator('main[data-variant], .su-ec-outer, .su-entity-compact').first()
    ).toBeVisible()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await read(name)
  }
  await pane.getByRole('button', { name: 'Back to Actions' }).click()
  await expect(pane).toHaveCount(0)
  return names.length
}
