import { buildPilot, openSheetFor } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Print preview — A4 and US Letter, against the LiveSheet shell.
 *
 * Builds a pilot, opens the live sheet, then verifies the existing A4 print
 * stylesheet still renders the new markup acceptably. Playwright exposes
 * `emulateMedia({ media: 'print' })` to switch the CSS media query.
 *
 * Real print fidelity is a maintainer-reviewed checkpoint — these tests
 * verify the stylesheet doesn't catastrophically hide content (hero name,
 * class chip, trackable stat pips) and that chrome (top-bar links) IS
 * hidden, not pixel-level layout.
 */
test.describe('sheet print preview', () => {
  test.beforeEach(async ({ page }) => {
    // This spec's beforeEach pays two full cold page-loads (buildPilot +
    // openSheetFor), so triple Playwright's time budget for the whole test.
    test.slow()
    await buildPilot(page, 'PT', 'Print Test')
    await openSheetFor(page, 'Print Test')
    // The sheet route titles the tab with the pilot's callsign (its `head`, r8 F1).
    await expect(page).toHaveTitle(/^Print Test · Training Bay · SalvageUnion\.io$/)
  })

  test('renders critical content under print @ A4', async ({ page }) => {
    // A4: 794 × 1123 CSS px at 96dpi
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.emulateMedia({ media: 'print' })

    // The pilot's name should be visible in print (LiveSheet hero <h1>).
    // The print CSS hides the <header>, whose condensed copy of the name is
    // a <span>; role=heading targets the visible hero <h1> and dodges it.
    await expect(page.getByRole('heading', { name: 'Print Test' })).toBeVisible()
    // The class must also survive print: the hero band's `CLASS | Engineer`
    // chip (R11's SheetHero), named by its control, so this fails if the
    // class stops rendering rather than matching some unrelated occurrence.
    await expect(page.getByRole('button', { name: 'Class: Engineer' })).toBeVisible()
    // Stat pips keep their print hooks (filled pips survive the bg reset).
    expect(await page.locator('[data-pip]').count()).toBeGreaterThan(0)
    // Top-bar navigation is hidden under print (`header a` rule).
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeHidden()
    await expect(page.getByRole('link', { name: /edit this pilot/i })).toBeHidden()
  })

  test('prints the Read view from Edit, every name whole (r4 E9)', async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    // Edit's controls are up on screen.
    const manage = page.getByRole('button', { name: 'Manage Abilities' })
    await expect(manage).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    // Paper is the Read view: no field, no "+ Add", whichever tab was up.
    await expect(page.getByRole('heading', { name: 'Print Test' })).toBeVisible()
    await expect(manage).toHaveCount(0)
    await expect(page.locator('main').locator('input, textarea')).toHaveCount(0)
    // No name or masthead label is cut on paper.
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.su-entity-mini__name, .su-strip__label')]
        .filter((el) => el.getClientRects().length > 0 && el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent)
    )
    expect(cut).toEqual([])

    // Back on screen the sheet is on the tab it was on.
    await page.emulateMedia({ media: 'screen' })
    await expect(manage).toBeVisible()
  })

  test('prints on two Letter pages: TP with its number, every ability title whole (r8 F2)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 816, height: 1056 })
    await page.emulateMedia({ media: 'print' })
    // TP prints its number, as HP and AP do (its value is a button on screen).
    await expect(page.locator('[data-vital="tp"] .su-strip__num')).toHaveText(/\d/)
    await expect(page.locator('[data-vital="tp"] .su-strip__num button')).toBeVisible()
    // No title breaks inside a word: each word of a Mini's name is one box.
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.su-entity-mini__name')]
        .filter((el) => el.getClientRects().length > 0)
        .flatMap((el) => {
          const text = el.firstChild
          if (!(text instanceof Text)) return []
          const words = [...(text.data.matchAll(/\S+/g) ?? [])]
          return words
            .filter((word) => {
              const range = document.createRange()
              range.setStart(text, word.index ?? 0)
              range.setEnd(text, (word.index ?? 0) + word[0].length)
              const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)))
              return lines.size > 1
            })
            .map((word) => word[0])
        })
    )
    expect(broken).toEqual([])
    // The Pilot sheet fits two pages.
    const pdf = await page.pdf({ format: 'Letter', preferCSSPageSize: false })
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []
    expect(pages.length).toBeLessThanOrEqual(2)
  })

  test('renders critical content under print @ US Letter', async ({ page }) => {
    // US Letter: 816 × 1056 CSS px at 96dpi
    await page.setViewportSize({ width: 816, height: 1056 })
    await page.emulateMedia({ media: 'print' })

    await expect(page.getByRole('heading', { name: 'Print Test' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Class: Engineer' })).toBeVisible()
  })
})
