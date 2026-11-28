import { expect, test } from './fixtures'

test.use({ account: 'anonymous' })

/**
 * A Reference page on paper (r4 E9): the page, without the website around it.
 * `emulateMedia({ media: 'print' })` switches the CSS media, as the sheet's
 * print spec does (`print-preview.e2e.ts`).
 */
test.describe('Reference print', () => {
  test('a filtered listing prints without the site chrome and says its filter', {
    tag: '@pr',
  }, async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.goto('/chassis/?tl=2')
    await expect(page.getByRole('link', { name: 'Forge' })).toBeVisible()
    const printed = page.getByText(/^Filtered to Tech Level 2: \d+ of \d+$/)
    // On screen the rail says it; the line is paper's.
    await expect(printed).toBeHidden()

    await page.emulateMedia({ media: 'print' })
    await expect(printed).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Chassis' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Forge' })).toBeVisible()
    await expect(page.locator('.su-union-bar')).toBeHidden()
    await expect(page.locator('.su-footer .su-chapter-foot__row')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Catalog' })).toBeHidden()
    // A column keeps its label: it is the table's head.
    await expect(page.getByRole('button', { name: /^Sort by SP/ })).toBeVisible()
  })

  test('an entity page prints without its buttons', async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.goto('/classes/hacker/')
    await expect(page.getByRole('button', { name: /share/i }).first()).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('heading', { level: 1, name: 'Hacker' })).toBeVisible()
    await expect(page.locator('.su-union-bar')).toBeHidden()
    await expect(page.locator('.su-footer .su-chapter-foot__row')).toBeHidden()
    // It says where it came from: the book and page, and its address (r5 E9).
    await expect(page.locator('.su-footer__citation')).toBeVisible()
    await expect(page.locator('.su-footer__address')).toHaveText(/\/classes\/hacker\/$/)
    await expect(page.getByRole('button', { name: /share/i })).toHaveCount(0)
    await expect(page.getByText(/build with this/i).first()).toBeHidden()
  })
})
