import { expect, test } from '@playwright/test'
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
 * **The two halves are two tests on purpose.** They used to be one, and the
 * snapshot half sat behind two `waitFor(...).catch(() => false)` probes with a
 * bare `return`: on every environment CI actually runs, the publish button is
 * absent (a static `vite preview` serves no Netlify Functions), so the round-
 * trip returned before asserting anything and Playwright reported a **pass**.
 * Ten seconds of waiting, a green tick, and zero coverage of the thing named
 * in the file.
 *
 * Split, the report tells the truth:
 *
 *  - the build + wiring test runs everywhere and passes on its own merits;
 *  - the round-trip test is reported as **skipped, with the reason**, unless
 *    `E2E_BASE_URL` points at a deploy that serves the snapshot Functions +
 *    Blobs — and when it does, there is no soft-skip left: a missing Publish
 *    button or a publish that never opens its dialog is a failure, because in
 *    that mode the backend was promised.
 *
 * `E2E_BASE_URL` is what `playwright.config.ts` already builds its external-
 * preview mode around (widened timeouts, no local `webServer`). Nothing sets
 * it today, so the round-trip reads as an honest skip rather than a phantom
 * pass; a nightly job that sets it to a Netlify preview turns it on. Its
 * substitute coverage meanwhile is `src/lib/snapshot/__tests__/snapshot.test.ts`,
 * which drives `makeRetrieveHandler` against injected storage.
 *
 * IndexedDB persists across page navigations inside one context, so building
 * entities before wiring works without state plumbing. Each test gets a fresh
 * context, hence a fresh IndexedDB — which is why the second test builds its
 * own pilot rather than inheriting the first test's.
 */

/**
 * Whether this run targets a deployment with the snapshot backend behind it.
 * `playwright.config.ts` treats the same variable as "run against a live
 * deploy", and that deploy is the only place Functions + Blobs exist.
 */
const FUNCTIONS_BACKED = Boolean(process.env.E2E_BASE_URL)

const NO_BACKEND_REASON =
  'Snapshot publish needs the Netlify Functions backend. Set E2E_BASE_URL to a deploy that serves it (a static `vite preview` cannot).'

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
  await expect(page.getByRole('link', { name: /Assigned Pilot: Mira Voss/i })).toBeVisible()

  // --- RailChip navigates (TanStack Link, client-side) to the pilot sheet ---
  await page.getByRole('link', { name: /Assigned Pilot: Mira Voss/i }).click()
  await page.waitForURL(/\/sheet\/pilot\//, { timeout: 10_000 })

  // There is deliberately no top-bar "edit this pilot" link any more: the edit
  // wizard route is gone (/pilots/$id is a bare redirect) and the Live Sheet is
  // itself the Free Edit surface under ADR-021, edited in place per section.
  // `Sheet-topbar-segments.test.tsx` pins its ABSENCE, so asserting it here
  // would contradict a unit test rather than guard anything.
  await expect(page.getByRole('link', { name: /edit this pilot/i })).toHaveCount(0)

  // --- Wire the crawler from the pilot sheet's rail ---
  await assignCrawlerOnPilotSheet(page, 'Iron Wagon')

  // The mech chip is still on the pilot sheet's rail (full wired composition).
  await expect(page.getByRole('link', { name: /Assigned Mech: Iron Fist/i })).toBeVisible()
})

test('publish a snapshot and open the share URL read-only', async ({ page }) => {
  test.skip(!FUNCTIONS_BACKED, NO_BACKEND_REASON)

  // A snapshot of a pilot is the whole round-trip; the wiring above is the
  // other test's subject, so this one builds only what it shares.
  await buildPilot(page, 'Mira Voss', 'Sparks')
  await openSheetFor(page, 'Mira Voss')

  // No soft-skip past this line. `ShareSnapshotScreen` hides Publish when
  // `probeSnapshotService` cannot reach the service — against a deploy that is
  // supposed to serve it, that is a broken backend, and this test's job is to
  // say so rather than return green.
  const shareButton = page.getByRole('button', { name: /publish snapshot/i })
  await expect(
    shareButton,
    'Publish is feature-gated on probeSnapshotService reaching the snapshot Functions; E2E_BASE_URL is set, so it should have.'
  ).toBeVisible()

  await shareButton.click()

  await expect(
    page.getByRole('dialog'),
    'Publishing opens the share dialog only when the Function accepted the snapshot.'
  ).toBeVisible()

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
