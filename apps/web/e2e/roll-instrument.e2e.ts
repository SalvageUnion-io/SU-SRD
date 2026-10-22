import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * R8, one roll instrument (docs/design-system/hard-rules.md; ruleset §2.4,
 * §3.4; EDL E14): a table is `RollTableInstrument`, open on a Page, its ROLL
 * THE DIE stamp the one roll control, a result its marked row, and that mark
 * the same for every outcome.
 *
 * - A Page with a table shows its bands without a click: an entity's own
 *   (Auto-Turret's), a guide step's and a roll table's page, in the server
 *   markup as after the island mounts, with no toggle to press.
 * - Two rolls that land on different outcomes mark their rows with identical
 *   computed styles: the web never colours a roll by how it went.
 */

/** Pages whose tables must stand open: an entity's own, a guide's step, a roll table's. */
const PAGES = [
  '/crawler-bays/trading-bay/',
  '/roll-tables/core-mechanic/',
  '/guides/create-a-pilot/',
] as const

// What any visitor sees: nothing here needs an account.
test.use({ account: 'anonymous' })

for (const path of PAGES) {
  test(`${path} shows its table's bands without a click`, async ({ page }) => {
    await page.goto(path)
    const instrument = page.locator('main .su-roll').first()
    await expect(instrument).toBeVisible({ timeout: 30_000 })
    const rows = instrument.locator('.su-roll__row, .su-roll__cell')
    expect(await rows.count(), `${path}: the table's bands are on the page`).toBeGreaterThan(0)
    await expect(rows.first()).toBeVisible()
    // Nothing folds it: no Table / Hide toggle anywhere on the page.
    await expect(
      page.locator('main').getByRole('button', { name: /^(Show|Hide) the .* table$/ })
    ).toHaveCount(0)
  })
}

/** What a marked row and its pennant look like, as drawn. */
async function markStyle(page: Page) {
  return page.locator('main .su-roll [aria-current="true"]').evaluate((row) => {
    const pick = (el: Element | null) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        background: s.backgroundColor,
        color: s.color,
        border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
        shadow: s.boxShadow,
        weight: s.fontWeight,
        opacity: s.opacity,
      }
    }
    return {
      key: row.querySelector('.su-roll__range')?.textContent ?? '',
      style: {
        row: pick(row),
        label: pick(row.querySelector('.su-roll__label')),
        value: pick(row.querySelector('.su-roll__value')),
        tag: pick(row.querySelector('.su-roll__tag')),
      },
    }
  })
}

/** Every `Math.random()` draw returns `draw`, so every d20 is `floor(draw * 20) + 1`. */
async function seed(page: Page, die: number) {
  await page.evaluate((d) => {
    Math.random = () => (d - 1) / 20 + 0.001
  }, die)
}

test('two outcomes mark their rows with identical computed styles (§3.4)', async ({ page }) => {
  await page.goto('/roll-tables/core-mechanic/')
  const roll = page.getByRole('button', { name: 'Roll the die on Core Mechanic' })
  await expect(roll).toBeVisible({ timeout: 30_000 })

  await seed(page, 14)
  await roll.click()
  await expect(page.locator('main .su-roll__tag')).toHaveText('Rolled 14')
  const success = await markStyle(page)

  await seed(page, 1)
  await roll.click()
  await expect(page.locator('main .su-roll__tag')).toHaveText('Rolled 1')
  const cascade = await markStyle(page)

  expect(success.key, 'the two rolls landed on different outcomes').not.toBe(cascade.key)
  expect(cascade.style, 'a Cascade Failure is marked as a Success is').toEqual(success.style)
})
