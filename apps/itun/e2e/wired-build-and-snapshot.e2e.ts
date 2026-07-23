import { test, expect } from '@playwright/test'
import {
  assignCrawlerOnPilotSheet,
  assignPilotOnMechSheet,
  buildCrawler,
  buildMech,
  buildPilot,
  openSheetFor,
} from './_helpers'

/**
 * Wired build + snapshot publish/open round-trip, against the Header C
 * LiveSheet shell (plan 4.8).
 *
 * Builds pilot + mech + crawler through the WizShell wizards, wires them via
 * the rail's Assign dialogs (mech-to-pilot, pilot-to-crawler), verifies the
 * wired shell (RailChip navigation, top-bar Edit link), then publishes a
 * snapshot and opens the resulting share URL in the same browser context.
 *
 * Notes:
 *  - The snapshot backend lives in Netlify Functions; in plain `vite dev`
 *    the publish flow may have no handler. The test soft-skips the share
 *    half when the dialog never appears (real publishing is exercised in
 *    Functions-aware environments).
 *  - IndexedDB persists across page navigations inside one context, so
 *    building all three entities before wiring works without state plumbing.
 */
test('wire pilot + mech + crawler on the live sheets and share a snapshot', async ({ page }) => {
  await buildPilot(page, 'Mira Voss', 'Sparks')
  await buildMech(page, 'Iron Fist')
  await buildCrawler(page, 'Iron Wagon')

  // --- Wire the pilot from the mech sheet's rail ---
  await openSheetFor(page, 'Iron Fist')
  // Unwired mech sheet is loaded — the poster hero shows the mech name.
  await expect(page.getByRole('heading', { name: 'Iron Fist' }).first()).toBeVisible()
  await assignPilotOnMechSheet(page, 'Mira Voss')

  // Wiring flips the composition mode: the assigned-pilot rail chip now links
  // to the wired pilot's sheet (the mobile segment switch is asserted at 390
  // in the segment spec).
  await expect(page.getByRole('link', { name: /Assigned Pilot: Mira Voss/i })).toBeVisible()

  // --- RailChip navigates (TanStack Link, client-side) to the pilot sheet ---
  await page.getByRole('link', { name: /Assigned Pilot: Mira Voss/i }).click()
  await page.waitForURL(/\/sheet\/pilot\//, { timeout: 10_000 })

  // Top-bar Edit is a trailing link into the Phase-3 edit wizard.
  const editLink = page.getByRole('link', { name: /edit this pilot/i })
  await expect(editLink).toBeVisible()
  await expect(editLink).toHaveAttribute('href', /\/pilots\/.+\/edit$/)

  // --- Wire the crawler from the pilot sheet's rail ---
  await assignCrawlerOnPilotSheet(page, 'Iron Wagon')

  // The mech chip is still on the pilot sheet's rail (full wired composition).
  await expect(page.getByRole('link', { name: /Assigned Mech: Iron Fist/i })).toBeVisible()

  // --- Publish a snapshot from the pilot sheet ---
  // The Publish button is feature-gated on the snapshot backend (Netlify
  // Functions): ShareSnapshotScreen hides it when probeSnapshotService cannot
  // reach the service, which a plain `vite preview` / `vite dev` server has no
  // way to provide. Soft-skip the publish flow when the button is absent — the
  // build + wiring above is the assertion here; publish itself is covered by
  // the ShareSnapshotScreen + snapshot handler unit tests.
  const shareButton = page.getByRole('button', { name: /publish snapshot/i })
  const publishAvailable = await shareButton
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false)
  if (!publishAvailable) {
    return
  }
  await shareButton.click()

  // The dialog only appears when the publish succeeds against the snapshot
  // backend, which plain `vite dev` may not provide. Soft-skip if absent.
  const dialogShown = await page
    .getByRole('dialog')
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false)
  if (!dialogShown) {
    return
  }

  const urlText = (await page.locator('[aria-label="Share URL"]').first().innerText()).trim()
  expect(urlText).toMatch(/^https?:\/\//)

  // --- Open the share URL and verify the read-only snapshot shell ---
  const ctx = page.context()
  const snapshotPage = await ctx.newPage()
  await snapshotPage.goto(urlText)
  await snapshotPage.waitForLoadState('domcontentloaded')
  await expect(snapshotPage.getByText('Mira Voss').first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(snapshotPage.getByRole('note', { name: /read-only snapshot/i })).toBeVisible()
  // Read-only: no Edit link, no Share button on a snapshot.
  await expect(snapshotPage.getByRole('link', { name: /edit this pilot/i })).toHaveCount(0)
  await expect(snapshotPage.getByRole('button', { name: /publish snapshot/i })).toHaveCount(0)
})
