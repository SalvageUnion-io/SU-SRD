import { buildMech, openSheetFor } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Save a mech as a pattern from its dialog, share it by link, open its page
 * signed out, and build a mech from it.
 *
 * Signed in (the default `test` from `fixtures.ts`), so it SKIPS with a stated
 * reason in a build with no test sign-in seam and runs for real in the nightly
 * `e2e` job. Saving and sharing are room writes, and the page is the
 * deliberately unauthenticated `publicSheet.pattern` — so it needs a backend.
 */

test('save a pattern, read it signed out, and build a mech from it', async ({ page, browser }) => {
  await buildMech(page, 'Iron Fist')
  await openSheetFor(page, 'Iron Fist')

  // --- P1: Save as pattern, from the mech sheet's ⋯ menu, in its dialog ---
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('button', { name: 'Save as pattern' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save as pattern' })
  // The pattern as its chassis lists it, in Edit: homebrew, the name in its cut-out.
  await expect(dialog.getByText('Homebrew', { exact: true }).first()).toBeVisible()
  await dialog.getByLabel('Pattern name', { exact: true }).fill('Tow Rig')
  await dialog.getByLabel('Pattern description', { exact: true }).fill('Rig first, rivet later.')
  await dialog.getByRole('button', { name: 'Save pattern' }).click()

  // A saved pattern opens on its own page, its maker's alone until shared.
  await page.waitForURL(/\/p\/pattern\/[^/]+$/, { timeout: 20_000 })
  const link = page.url()
  await page.getByRole('button', { name: 'Share Tow Rig' }).click()
  const anyone = page.getByRole('radio', { name: /^Public/ })
  await anyone.click()
  // Controlled by the server's answer: checked once the write lands.
  await expect(anyone).toBeChecked({ timeout: 15_000 })
  await page.keyboard.press('Escape')

  // --- P2: the public page, with no account at all ---
  const visitor = await browser.newContext()
  try {
    const publicPage = await visitor.newPage()
    await publicPage.goto(link)
    await expect(publicPage.getByRole('heading', { level: 1, name: /Tow Rig/ })).toBeVisible({
      timeout: 15_000,
    })
    await expect(publicPage.getByText('Homebrew', { exact: true }).first()).toBeVisible()
    await expect(publicPage.getByText('Homebrew // Made by', { exact: false })).toBeVisible()
    await expect(publicPage.getByText('Rig first, rivet later.')).toBeVisible()
    // Read-only: building needs an account.
    await expect(
      publicPage.getByRole('button', { name: /^Build With This: a mech from / })
    ).toHaveCount(0)
  } finally {
    await visitor.close()
  }

  // --- Build a mech from it, signed in ---
  await page.getByRole('button', { name: /^Build With This: a mech from / }).click()
  await page.waitForURL(/\/build\/mechs\/(?!new)/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Tow Rig' }).first()).toBeVisible()

  // The pattern page counts it.
  await page.goto(link)
  await expect(page.getByText('1 mech built from it')).toBeVisible({ timeout: 15_000 })
})
