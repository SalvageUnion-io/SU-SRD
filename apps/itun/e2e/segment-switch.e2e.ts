import { expect, test } from '@playwright/test'
import { assignPilotOnMechSheet, buildMech, buildPilot, openSheetFor } from './_helpers'

/**
 * Mobile segment switch (design §3.7, plan 4.8) — at the 390 endpoint a
 * wired sheet stitches a segmented Pilot/Mech/Crawler switch into the sticky
 * top bar: one flex-1 sm btn per wired counterpart, the viewed kind active
 * (rust fill, aria-current="page"), the others navigating to their sheets.
 *
 * Desktop keeps the rail chips and hides the switch; unwired sheets never
 * render it at any width.
 */
test.describe('wired sheet segment switch', () => {
  test.beforeEach(async ({ page }) => {
    await buildPilot(page, 'Mara Vex', 'Wrench')
    await buildMech(page, 'Stomper')
    await openSheetFor(page, 'Stomper')
    await assignPilotOnMechSheet(page, 'Mara Vex')
  })

  test('switches between wired sheets at 390', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    const nav = page.getByRole('navigation', { name: /wired sheets/i })
    await expect(nav).toBeVisible()

    // Active segment = the sheet being viewed: rust fill, not a link.
    const active = nav.locator('[aria-current="page"]')
    await expect(active).toHaveText('Mech')
    await expect(active).toHaveClass(/bg-rust/)

    // Tapping the pilot segment navigates to the wired pilot's sheet.
    await nav.getByRole('link', { name: 'Pilot' }).click()
    await page.waitForURL(/\/sheet\/pilot\//, { timeout: 10_000 })

    // The switch follows: Pilot is now active, Mech is the link back.
    const pilotNav = page.getByRole('navigation', { name: /wired sheets/i })
    await expect(pilotNav.locator('[aria-current="page"]')).toHaveText('Pilot')
    await expect(pilotNav.getByRole('link', { name: 'Mech' })).toBeVisible()
  })

  test('hidden on desktop (rail chips serve navigation)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    await expect(page.getByRole('navigation', { name: /wired sheets/i })).toBeHidden()
    // The rail chip remains the desktop navigation affordance.
    await expect(page.getByRole('link', { name: /Assigned Pilot: Mara Vex/i })).toBeVisible()
  })

  test('absent on unwired sheets at 390', async ({ page }) => {
    // Mara Vex and Stomper are wired to each other — use a fresh unwired mech.
    await buildMech(page, 'Loner')
    await openSheetFor(page, 'Loner')
    await page.setViewportSize({ width: 390, height: 844 })

    await expect(page.getByRole('navigation', { name: /wired sheets/i })).toHaveCount(0)
  })
})
