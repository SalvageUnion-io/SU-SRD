import { at } from './_base'
import { expect, test } from './fixtures'

// What any visitor sees: nothing here needs an account.
test.use({ account: 'anonymous' })

/**
 * The site's one search and one 404, inside the Cantina: the Union bar's
 * search is the reference pages' own (the compact index, a result opening the
 * reference page in the same tab), and an unknown route draws the site's 404
 * with its search and "did you mean", plus the way back to the Hangar.
 */
test('an unknown route shows the site 404 and leads back to the Hangar', async ({ page }) => {
  await page.goto(at('/no-such-route'))
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(main.getByRole('combobox', { name: 'Search the SRD' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Did you mean' })).toBeVisible()

  await main.getByRole('link', { name: /Back to Hangar/ }).click()
  await expect(page).toHaveURL(at('/'))
  await expect(page.getByRole('heading', { level: 1, name: /^The Cantina$/i })).toBeVisible()
})

test('the bar search opens a reference page in the same tab', async ({ page, context }) => {
  await page.goto(at('/'))
  const search = page.getByRole('combobox', { name: 'Search the SRD' }).first()
  await search.click()
  await search.fill('Mule')
  const result = page.locator('[role="option"][href="/chassis/mule/"]')
  await expect(result).toBeVisible()

  await result.click()
  await expect(page).toHaveURL(/\/chassis\/mule\/$/)
  expect(context.pages()).toHaveLength(1)
})
