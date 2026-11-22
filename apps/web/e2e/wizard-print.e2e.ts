import { runWizard } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Print from a wizard's Review, signed out (r3 E1): for a builder with no
 * account the printed page is the one readable copy of the build, so it must
 * be the sheet. The page is printed to PDF by the browser's own engine, and
 * the same layout is read under print media.
 */
test.use({ account: 'anonymous' })

/** A4 at 96dpi, less `print.css`'s 10mm page margin on each side. */
const PAPER = { width: 718, height: 1047 }

test.describe('wizard Review print', () => {
  test('the pilot prints as its sheet: from the first page, names and class text whole, no chrome across it', async ({
    page,
  }) => {
    test.slow()
    await runWizard(page, 'pilots', {
      identity: { name: 'Mara Voss', callsign: 'Ghost' },
      prefer: ['Engineer'],
    })
    await expect(page.getByRole('button', { name: /Create Pilot/i })).toBeVisible()

    await page.setViewportSize(PAPER)
    await page.emulateMedia({ media: 'print' })

    const main = page.locator('.su-wiz-main')
    // The build starts the first sheet: nothing blank above it.
    const top = await main.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    expect(top).toBeLessThan(40)
    // Every ability and equipment line prints its name, and the class text
    // keeps its linked words.
    const names = main.locator('.su-ledger__name')
    expect(await names.count()).toBeGreaterThan(1)
    for (const name of await names.all()) {
      await expect(name.locator('.su-inline-ref')).toBeVisible()
      expect(((await name.innerText()) ?? '').trim()).not.toBe('')
    }
    for (const word of await main.locator('.su-inline-ref').all()) await expect(word).toBeVisible()
    // The wizard's chrome stays off the paper, and the site's footer follows
    // the build: never across it.
    await expect(page.locator('.su-wiz-footer')).toBeHidden()
    await expect(page.getByText('Keep it without an account')).toBeHidden()
    const stepEnd = await page
      .locator('.su-wiz-step-frame')
      .evaluate((el) => el.getBoundingClientRect().bottom)
    const footerTop = await page
      .locator('footer.su-footer')
      .evaluate((el) => el.getBoundingClientRect().top)
    expect(footerTop).toBeGreaterThanOrEqual(stepEnd)
    // A link reads as its words: no address printed after it.
    const after = await main
      .locator('a[href]')
      .evaluateAll((links) => links.map((a) => getComputedStyle(a, '::after').content))
    expect(after.every((content) => content === 'none')).toBe(true)

    // The same layout through the print pipeline (r3 E1 printed three sheets,
    // the first blank): the build starts the first sheet and ends by the second.
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true })
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []
    expect(pages.length).toBeLessThanOrEqual(2)
  })
})
