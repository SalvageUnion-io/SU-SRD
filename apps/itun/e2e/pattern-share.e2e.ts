import { buildMech, openSheetFor } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Save a mech as a pattern, open its public page signed out, and build a mech
 * from it (#1276, boards P1 and P2).
 *
 * Signed in (the default `test` from `fixtures.ts`), so it SKIPS with a stated
 * reason in a build with no test sign-in seam and runs for real in the nightly
 * `e2e-itun` job. Saving and sharing are Convex writes, and the page is the
 * deliberately unauthenticated `publicSheet.pattern` — so it needs a backend.
 */

test('save a pattern, read it signed out, and build a mech from it', async ({ page, browser }) => {
  await buildMech(page, 'Iron Fist')
  await openSheetFor(page, 'Iron Fist')

  // --- P1: Save as pattern, from the mech sheet's ⋯ menu ---
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('link', { name: 'Save as pattern' }).click()
  await page.waitForURL(/\/mechs\/patterns\/new\?from=/, { timeout: 15_000 })

  const name = page.getByLabel('Pattern name')
  await name.fill('Tow Rig')
  await page.getByLabel('Notes for whoever builds it').fill('Rig first, rivet later.')
  await page.getByLabel(/Anyone with the link/).check()
  // The preview is the pattern as others will see it: user-made.
  await expect(page.getByText('User-made', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Save pattern' }).click()

  // A shared pattern opens on its own page.
  await page.waitForURL(/\/p\/pattern\/[^/]+$/, { timeout: 20_000 })
  const link = page.url()

  // --- P2: the public page, with no account at all ---
  const visitor = await browser.newContext()
  try {
    const publicPage = await visitor.newPage()
    await publicPage.goto(link)
    await expect(publicPage.getByRole('heading', { level: 1, name: /Tow Rig/ })).toBeVisible({
      timeout: 15_000,
    })
    await expect(publicPage.getByText('User-made pattern')).toBeVisible()
    await expect(publicPage.getByText('Rig first, rivet later.')).toBeVisible()
    // Read-only: building needs an account.
    await expect(publicPage.getByRole('button', { name: 'Build this mech' })).toHaveCount(0)
  } finally {
    await visitor.close()
  }

  // --- Build a mech from it, signed in ---
  await page.getByRole('button', { name: 'Build this mech' }).click()
  await page.waitForURL(/\/sheet\/mech\//, { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Tow Rig' }).first()).toBeVisible()

  // The pattern page counts it.
  await page.goto(link)
  await expect(page.getByText('1 mech built from it')).toBeVisible({ timeout: 15_000 })
})
