import { expect, test } from '@playwright/test'
import { advanceUntilVisible, clickNext, pickByName, waitForReady } from './_helpers'

/**
 * Pilot wizard happy path — create a pilot, then EDIT it (add a second ability
 * beyond the creation budget), reload, and verify persistence. Runs through a
 * real browser engine so it catches Chromium-level CSS/interaction issues the
 * happy-dom integration tests can't.
 *
 * CREATION BUDGETS ARE THE RULEBOOK'S, NOT THIS FILE'S. A pilot starts with
 * exactly **1** Ability (Core Book p.18) and **2** Tech 1 Equipment (p.19) —
 * `PILOT_CREATION_ABILITY_PICKS` / `PILOT_CREATION_EQUIPMENT_PICKS` in
 * `salvageunion-reference/lib/rules/creation.ts` are the source of truth. This
 * spec previously walked a separate "Abilities" step and asserted `3 / 3`,
 * which had stopped matching both the wizard's shape and the rule it was
 * meant to be guarding. If these numbers ever disagree with the constants
 * again, fix whichever is wrong by checking the book — do not simply relax
 * the test to whatever the app currently does.
 */
test('build a pilot from scratch, then edit to add a second ability', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)

  // Step 1: Your Stats — derived starting values, nothing to choose.
  await clickNext(page)

  // Step 2: Class & Ability — the class, then exactly one Ability from the
  // trees that class reveals. Both halves gate Next.
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')
  await clickNext(page)

  // Step 3: Equipment — exactly two Tech 1 picks.
  const equipmentOptions = page.locator('[aria-pressed="false"], [aria-checked="false"]')
  await expect(equipmentOptions.first()).toBeVisible()
  await equipmentOptions.first().click()
  await equipmentOptions.first().click()
  await expect(page.getByTestId('equipment-count')).toHaveText('2 / 2')
  await clickNext(page)

  // Step 4: identity — name + callsign both required before Next opens.
  await page.getByLabel(/^Name/).fill('Mira Voss')
  await page.getByLabel(/Callsign/).fill('Sparks')

  // Steps 5-8 (Background / Motto / Keepsake / Appearance) are optional prose.
  // Walk to the Create CTA rather than counting them, so inserting or removing
  // an optional step does not break this spec — the mistake that put the whole
  // suite on the floor.
  const createPilot = page.getByRole('button', { name: /Create Pilot/i })
  await advanceUntilVisible(page, createPilot)

  // Review shows what we entered.
  await expect(page.getByText(/Mira Voss/).first()).toBeVisible()
  await expect(page.getByText(/Sparks/).first()).toBeVisible()
  await createPilot.click()

  // After submission we land on the roster.
  await page.waitForURL(/\/$/, { timeout: 15_000 })
  await waitForReady(page)
  await expect(page.getByText('Mira Voss').first()).toBeVisible({
    timeout: 15_000,
  })

  // --- Advancement, on the live sheet ---
  //
  // This used to walk /pilots/$id → /pilots/$id/edit and re-run the wizard in
  // "edit mode". Both routes are gone: /pilots/$id is now a bare redirect
  // (see its route file) and the per-entity detail page was collapsed into the
  // live sheet, which under ADR-021 is the Free Edit surface — you edit in
  // place rather than replaying Guided Creation. The INTENT is unchanged and is
  // what matters: an ability beyond the creation budget can be added, and it
  // persists.
  // Matched on `href`, not the label. EntityRow's sheet link reads "View" on
  // every row, so it carries `aria-label="View <name>"` for WCAG 2.4.4 — which
  // means its ACCESSIBLE NAME is not "View" and `/^View$/` matches nothing.
  // The locator is already scoped to this entity's row, so the href is the
  // contract that matters and it survives the next copy change. This is the
  // same reasoning `openSheetFor` in `_helpers.ts` records.
  await page.locator('a[href*="/sheet/"]').first().click()
  await page.waitForURL(/\/sheet\/pilot\//, { timeout: 15_000 })
  await waitForReady(page)

  // The Abilities section header's manage control opens the one shared picker
  // modal. It writes through on toggle — there is no Save button to press.
  //
  // `Manage abilities`, not `+ Add ability`. `SectionManageButton` labels itself
  // `Manage ${label}` and PilotSheet passes label="abilities"; the old copy has
  // not existed for some time. The component tests in
  // `sheet/__tests__/sheet-soft-warnings.test.tsx` were already using the
  // current label, so only this e2e spec was left behind — which is why the
  // break showed up as a nightly 90-second click timeout rather than a unit
  // failure. `mech-build.e2e.ts` uses the same `/^Manage systems$/i` shape.
  await page.getByRole('button', { name: /^Manage abilities$/i }).click()
  const picker = page.getByRole('dialog')
  await expect(picker).toBeVisible()

  // 'Talk Shop' is Mechanical Knowledge level 2, so creation never offers it —
  // reaching it here is exactly the advancement-past-the-budget case.
  await picker.getByText('Talk Shop').first().click()
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()

  await expect(page.getByText('Talk Shop').first()).toBeVisible({
    timeout: 15_000,
  })

  // Reload — the edit persisted to IndexedDB (no duplicate pilot).
  await page.reload()
  await waitForReady(page)
  await expect(page.getByText('Talk Shop').first()).toBeVisible({
    timeout: 15_000,
  })
  await page.goto('/')
  await waitForReady(page)
  // One sheet link on the roster. Matched by href rather than by label for the
  // reason above — and by href specifically because this asserts a COUNT across
  // all rows, so it must not depend on any single entity's name.
  await expect(page.locator('a[href*="/sheet/"]')).toHaveCount(1)
})

test('the creation ability budget caps at one pick', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)

  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')

  // Further level-1 abilities stay on screen and stay clickable, but the
  // budget holds: clicking them cannot push the count past the rulebook's one
  // pick. That invariant — not the presence of any particular affordance — is
  // what this test guards. It used to look for a "Budget reached" message and
  // then assert `count >= 0`, which is true of every number, so it could not
  // fail; the message no longer renders at all.
  for (const other of ['Jury Rig', 'Mass Field Maintenance']) {
    const card = page
      .getByRole('button')
      .or(page.getByRole('radio'))
      .filter({ hasText: other })
      .first()
    if (!(await card.isVisible().catch(() => false))) continue
    await card.click().catch(() => {})
    await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')
  }

  // And the step stays satisfiable — the budget gates the count, not progress.
  await expect(page.getByRole('button', { name: /^Next ·/ })).toBeEnabled()
})
