import { test, expect } from '@playwright/test'
import { advanceUntilVisible, clickNext, fillIdentity, pickByName, waitForReady } from './_helpers'

/**
 * MechWizard corner cases (Mech Workshop wizard):
 *  - The stepper gates progress: the Chassis step needs a chassis, and the Name
 *    step needs a name, before Create is enabled on Review.
 *  - The craft steps show their budget trackers — Scrap plus the slot budget
 *    for whichever of Systems / Modules is being crafted.
 *
 * Both cases were written against a Chassis → Pattern → Loadout → Identity →
 * Review wizard that no longer exists. There is no "Custom Pattern" card (a
 * chassis is picked directly), and no combined Loadout step with TL filter
 * chips and a 'Loadout · {name}' panel — that HUD is edit-mode only
 * (`if (!isEdit) return undefined` in MechWizard), while create mode shows the
 * WizTracker pill asserted below. Nothing about the first step is gated either:
 * "Gain Scrap" is informational, so Next is open from the start.
 */

test('wizard gates progress until chassis + name are set', async ({ page }) => {
  await page.goto('/mechs/new?mode=guided')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next ·/ })

  // Step 1 (Gain Scrap) is informational — nothing to satisfy.
  await expect(next).toBeEnabled()
  await clickNext(page)

  // Chassis step — Next is gated until a chassis is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Mule')
  await expect(next).toBeEnabled()

  // Name step — gated until the mech is named (its name IS its pattern).
  const nameEditor = page.getByLabel(/^Edit name \/ pattern$/i)
  await advanceUntilVisible(page, nameEditor)
  await expect(next).toBeDisabled()
  await fillIdentity(page, 'name / pattern', 'Iron Fist')
  await expect(next).toBeEnabled()

  // Review — Create is enabled.
  await clickNext(page)
  await expect(page.getByRole('button', { name: /Create Mech/i })).toBeEnabled()
})

test('the craft steps show their scrap and slot budget trackers', async ({ page }) => {
  await page.goto('/mechs/new?mode=guided')
  await waitForReady(page)

  await pickByName(page, 'Mule')

  // Systems craft step — Scrap plus the System Slots budget.
  const systemSlots = page.getByTestId('system-slot-count')
  await advanceUntilVisible(page, systemSlots)
  await expect(page.getByTestId('scrap-remaining')).toBeVisible()
  await expect(systemSlots).toHaveText(/\d+ \/ \d+/)

  // Modules craft step — Scrap plus its own Module Slots budget. These are
  // separate steps now, not two tabs of one Loadout step.
  const moduleSlots = page.getByTestId('module-slot-count')
  await advanceUntilVisible(page, moduleSlots)
  await expect(page.getByTestId('scrap-remaining')).toBeVisible()
  await expect(moduleSlots).toHaveText(/\d+ \/ \d+/)
})
