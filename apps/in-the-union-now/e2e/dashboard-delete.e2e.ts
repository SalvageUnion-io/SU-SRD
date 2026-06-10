import { test, expect } from '@playwright/test'
import { pickByName, waitForReady, clickNext } from './_helpers'

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
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Class step — each class is an EntityChoiceCard (div[role="button"]).
  await pickByName(page, 'Engineer')
  await clickNext(page)

  // Abilities step — skip (abilities are optional).
  await clickNext(page)

  // Equipment step — skip (equipment is optional).
  await clickNext(page)

  // Identity step — Name is rendered by PilotWizard above IdentityStep.
  await page.getByLabel(/^Name/).fill('Delete Me')
  await page.getByLabel(/Callsign/).fill('TBD')
  await clickNext(page)

  // Background step — skip.
  await clickNext(page)

  // Review step — submit.
  await page.getByRole('button', { name: /^Create Pilot$/i }).click()

  // Wait for the wizard to navigate to "/" after successful creation.
  // Use the exact path "/" to avoid matching "/pilots/new" which also
  // contains "/pilots/" and would resolve the old waitForURL too early.
  await page.waitForURL('/', { timeout: 20_000 })
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
  // DeleteConfirmDialog renders role="dialog" with heading "Delete {name}?"
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Delete Delete Me\?/i)).toBeVisible()

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
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Class step.
  await pickByName(page, 'Engineer')
  await clickNext(page)

  // Abilities step — skip.
  await clickNext(page)

  // Equipment step — skip.
  await clickNext(page)

  // Identity step.
  await page.getByLabel(/^Name/).fill('Keep Me')
  await page.getByLabel(/Callsign/).fill('OK')
  await clickNext(page)

  // Background step — skip.
  await clickNext(page)

  // Review step — submit.
  await page.getByRole('button', { name: /^Create Pilot$/i }).click()

  // Wait for navigation to "/" after creation.
  await page.waitForURL('/', { timeout: 20_000 })
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
