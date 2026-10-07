import {
  assignCrawlerOnPilotSheet,
  assignPilotOnMechSheet,
  buildCrawler,
  buildMech,
  buildPilot,
  openSheetFor,
} from './_helpers'
import { expect, test } from './fixtures'

/**
 * Wired build, then the share round-trip, against the Header C LiveSheet shell
 * (plan 4.8).
 *
 * **The two halves are two tests on purpose.** The wiring test is about the
 * live sheets; the share test is about the live public sheet
 * ([ADR-032](../../../docs/ARCHITECTURE.md#adr-032)), which is
 * the only way to share now that frozen snapshots are retired
 * ([ADR-036](../../../docs/ARCHITECTURE.md#adr-036)). This file
 * used to publish a snapshot and open its `/s/:id` link, behind an
 * `E2E_BASE_URL` skip because a static preview serves no snapshot API.
 *
 * Both are signed in (the default `test` from `fixtures.ts`), so both SKIP with
 * a stated reason in a build with no test sign-in seam and run for real in the
 * nightly `e2e-itun` job, which provisions one. Publishing is a Convex write,
 * and reading the page back is the deliberately unauthenticated
 * `publicSheet.get` — so the share test needs a Convex backend, not the Worker.
 *
 * IndexedDB persists across page navigations inside one context, so building
 * entities before wiring works without state plumbing. Each test gets a fresh
 * context and a fresh account, which is why the second test builds its own
 * pilot rather than inheriting the first test's.
 */

test('wire pilot + mech + crawler on the live sheets', async ({ page }) => {
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
  await expect(page.getByRole('link', { name: /View Mira Voss/i })).toBeVisible()

  // --- the rail row View link navigates (TanStack Link, client-side) to the pilot sheet ---
  await page.getByRole('link', { name: /View Mira Voss/i }).click()
  await page.waitForURL(/\/sheet\/pilot\//, { timeout: 10_000 })

  // There is deliberately no top-bar "edit this pilot" link any more: the edit
  // wizard route is gone (/pilots/$id is a Worker 301) and the Live Sheet is
  // itself the Free Edit surface under ADR-021, edited in place per section.
  // `Sheet-topbar-segments.test.tsx` pins its ABSENCE, so asserting it here
  // would contradict a unit test rather than guard anything.
  await expect(page.getByRole('link', { name: /edit this pilot/i })).toHaveCount(0)

  // --- Wire the crawler from the pilot sheet's rail ---
  await assignCrawlerOnPilotSheet(page, 'Iron Wagon')

  // The mech chip is still on the pilot sheet's rail (full wired composition).
  //
  // There is no link named "Assigned Mech: Iron Fist" — that was an older rail
  // markup where the whole row was one anchor. `EntityRow` now renders the role
  // as `meta` text and the navigation as a separate "View" link whose
  // accessible name is `View <name>`. Both halves are asserted, because the
  // point of this line is that the mech is STILL WIRED and reachable after the
  // crawler was assigned — a name check alone would pass on a row that had lost
  // its link.
  await expect(page.getByText('Assigned Mech')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View Iron Fist' })).toBeVisible()
})

test('publish the live public sheet and open it with no account', async ({ page, browser }) => {
  // A public pilot is the whole round-trip; the wiring above is the other
  // test's subject, so this one builds only what it shares.
  await buildPilot(page, 'Mira Voss', 'Sparks')
  await openSheetFor(page, 'Mira Voss')

  // Sharing is a dialog on the sheet, not a screen you navigate to.
  await page.getByRole('button', { name: /share this pilot/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Snapshots are retired: nothing in the dialog mints one.
  await expect(dialog.getByRole('button', { name: /snapshot/i })).toHaveCount(0)

  await dialog.getByRole('button', { name: /publish live sheet/i }).click()

  // The link appears only once the server has the sheet as public.
  await expect(
    dialog.getByRole('button', { name: /copy public sheet link/i }),
    'The copy control appears only once publicSheet.setPublic succeeded.'
  ).toBeVisible()
  const link = (await dialog.locator('code').first().innerText()).trim()
  expect(link).toMatch(/^https?:\/\/[^/]+\/p\/pilot\/[^/]+$/)

  // --- Open it in a context with no account at all ---
  const visitor = await browser.newContext()
  try {
    const publicPage = await visitor.newPage()
    await publicPage.goto(link)
    await publicPage.waitForLoadState('domcontentloaded')
    await expect(publicPage.getByText('Mira Voss').first()).toBeVisible({ timeout: 15_000 })
    // Read-only: a visitor gets no Share control and no way to edit.
    await expect(publicPage.getByRole('button', { name: /share this pilot/i })).toHaveCount(0)
  } finally {
    await visitor.close()
  }
})
