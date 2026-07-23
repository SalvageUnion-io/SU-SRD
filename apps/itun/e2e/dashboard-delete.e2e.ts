import { test, expect } from '@playwright/test'
import { buildPilot, waitForReady } from './_helpers'

/**
 * Dashboard delete flow: create a pilot, confirm the delete dialog, verify
 * the pilot disappears. Catches regressions in DeleteConfirmDialog and the
 * EntityListItem delete button cursor / focus wiring.
 *
 * Pilot creation wizard steps:
 *   1. Class    — pick a class card (div[role="button"] via EntityChoiceCard)
 *   2. Abilities — optionally pick abilities; skip with Next
 *   3. Equipment — optionally pick equipment; skip with Next
 *   4. Identity  — fill Name (rendered by PilotWizard) + Callsign (IdentityStep)
 *   5. Background — skip with Next
 *   6. Review    — click Create Pilot
 *
 * After creation the wizard navigates to "/" (the dashboard). We wait for the
 * exact URL "/" so the waitForURL resolves only after the SPA navigation
 * completes — not while still on "/pilots/new" (whose path also contains
 * "/pilots/", which tripped the old regex).
 *
 * Dashboard entity hydration is async (IndexedDB read inside useEffect). We
 * wait for the pilot's name to become visible in the entity list rather than
 * relying solely on waitForReady (which only signals game-data preload).
 *
 * The delete button uses aria-label="Delete <name>" on EntityListItem, so
 * getByRole('button', { name: /Delete <name>/i }) is the robust selector.
 * The confirm dialog uses role="dialog" with a "Delete" confirm button.
 */

test('create then delete a pilot from the dashboard', async ({ page }) => {
  // ── Step 1: Build a minimal pilot ──────────────────────────────────────────
  // The shared builder walks whatever steps the wizard currently has and
  // returns once the redirect to "/" has landed.
  await buildPilot(page, 'Delete Me', 'TBD')
  await waitForReady(page)

  // ── Step 2: Verify pilot appears and trigger delete ─────────────────────────
  // Wait for IndexedDB entity hydration to complete (hydratedAll = true)
  // and the pilot to appear in the Pilots list.
  await expect(page.getByLabel('Loading saved builds')).not.toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Delete Me')).toBeVisible({
    timeout: 15_000,
  })

  // EntityListItem renders: <Button aria-label="Delete {name}">Delete</Button>
  await page.getByRole('button', { name: /^Delete Delete Me$/i }).click()

  // ── Step 3: Confirm dialog ──────────────────────────────────────────────────
  // The ModalShell-backed ConfirmDialog renders the "Delete {name}?" title
  // three times (visible pseudoheader span + sr-only Dialog.Title/Description),
  // so assert containment on the dialog rather than a unique text locator.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('dialog')).toContainText('Delete Delete Me?')

  // Confirm button inside the dialog.
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Delete$/ })
    .click()

  // ── Step 4: Pilot should vanish from the list ───────────────────────────────
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Delete Me')).not.toBeVisible(
    { timeout: 10_000 }
  )
})

test('cancel delete keeps the pilot visible', async ({ page }) => {
  // ── Step 1: Build a minimal pilot ──────────────────────────────────────────
  await buildPilot(page, 'Keep Me', 'OK')
  await waitForReady(page)

  // ── Step 2: Verify pilot appears and open delete dialog ─────────────────────
  await expect(page.getByLabel('Loading saved builds')).not.toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Keep Me')).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: /^Delete Keep Me$/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })

  // ── Step 3: Cancel keeps the entity ─────────────────────────────────────────
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Cancel/ })
    .click()
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Keep Me')).toBeVisible({
    timeout: 5_000,
  })
})
