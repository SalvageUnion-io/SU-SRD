import { at } from './_base'
import { advanceUntilVisible, clickNext, editSheet, pickByName, waitForReady } from './_helpers'
import { expect, test } from './fixtures'

test.use({ account: 'anonymous' })
const OUT = process.env.SHOT_OUT ?? '/tmp'

test('hybrid picker shot', async ({ page }) => {
  await page.goto(at('/pilots/new?mode=guided'))
  await waitForReady(page)
  await clickNext(page)
  await pickByName(page, 'Scout')
  await pickByName(page, 'Gather Intelligence')
  await clickNext(page)
  const eq = page.locator('[aria-pressed="false"], [aria-checked="false"]')
  await expect(eq.first()).toBeVisible()
  await eq.first().click()
  await eq.first().click()
  await clickNext(page)
  await page.getByLabel(/^Name/).fill('Stum')
  await page.getByLabel(/Callsign/).fill('Stum')
  const create = page.getByRole('button', { name: /Create Pilot/i })
  await advanceUntilVisible(page, create)
  await create.click()
  await page.waitForURL(/\/$/, { timeout: 15_000 })
  await waitForReady(page)
  await page.locator('a[href*="/sheet/"]').first().click()
  await page.waitForURL(/\/sheet\/pilot\//, { timeout: 15_000 })
  await waitForReady(page)
  await editSheet(page)

  await page.getByRole('button', { name: 'Change class' }).first().click()
  const classDialog = page.getByRole('dialog')
  await classDialog
    .getByRole('radio', { name: /Ranger/ })
    .first()
    .click()
  await classDialog.getByRole('button', { name: 'Change Class', exact: true }).click()
  const confirm = page.getByRole('button', { name: /Change anyway|Confirm|Continue/i })
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click()
  await expect(page.getByText('Ranger').first()).toBeVisible()

  await page.getByRole('button', { name: /^Manage abilities$/i }).click()
  const picker = page.getByRole('dialog')
  await expect(picker).toBeVisible()
  await picker.getByRole('searchbox').first().fill('Survey')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/desktop.png` })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/phone.png` })
})
