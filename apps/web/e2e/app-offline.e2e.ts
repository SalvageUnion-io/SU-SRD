import type { Page } from '@playwright/test'
import { sheetLink } from 'gates/lib/appPage'
import { at } from './_base'
import { buildPilot, editSheet, openApp, openSheetFor, waitForReady } from './_helpers'
import { serviceWorkerReady } from './_serviceWorker'
import { expect, test } from './fixtures'

/**
 * Offline — the one spec that proves the app is actually a PWA rather than merely
 * configured as one, and that pins what offline means for a player's data. It
 * also proves the one install: one service worker precaches the reference and
 * the app (`src/pwa.ts`), so opened at `/`, both open with the network cut.
 *
 * ADR-034 decision 3 says an installed app works offline. The app ships a
 * service worker and a manifest, and this is the spec that exercises them —
 * the root Playwright config blocks service workers for every other spec.
 *
 * ## What offline promises
 *
 * The device copy (`docs/ARCHITECTURE.md#device-copy`, ADR-053) keeps the
 * signed-in player's own rows, read-only. So offline promises two things, and
 * this spec pins both:
 *
 *  - **Mid-session**, a signed-in player's open sheet stays on screen,
 *    read-only, under the NOT CONNECTED banner. The rows are this page load's
 *    in-memory copy; no worker is involved.
 *  - **After a reload**, the shell boots from the worker's precache and the
 *    player's own sheets come back from the device copy, read-only.
 *
 * ## Why service workers are re-enabled only here
 *
 * `serviceWorkers: 'block'` is the right default for every other spec. A worker
 * activating mid-navigation aborts `page.goto` with
 * `net::ERR_ABORTED; maybe frame was detached?`, which flaked the preview suite
 * for reasons that had nothing to do with what those tests were checking. So
 * this file opts back in for itself with `test.use` rather than the default
 * being loosened for everybody.
 *
 * ## Why it skips instead of failing when there is no worker
 *
 * `vite-plugin-pwa` emits a service worker for a **build**, not for the dev
 * server. CI serves the built bundle (`bun run preview`) and gets one; a developer
 * running `bun run dev` does not. A spec that failed in the second case
 * would be telling the truth about the server and a lie about the app, and
 * would get skipped-by-deletion the first time it annoyed somebody.
 *
 * So it waits for a controlling worker and skips with a stated reason if none
 * arrives. **In CI it does not skip**, which is where it counts.
 *
 * ## The first load is never offline-capable, and that is not a bug
 *
 * Under `registerType: 'prompt'` a freshly installed worker does not claim the
 * page that installed it, so a visitor who arrives and immediately loses the
 * network gets nothing. Offline begins at the *second* navigation. That is the
 * deliberate trade documented in `vite.config.ts` — claiming the open page is
 * what deleted the precache it was still reading from — and these tests reload
 * once for exactly that reason rather than papering over it.
 */

/**
 * Get the page to a state where a service worker is actually serving it.
 *
 * **A first load is never controlled, and that is by design.** The app runs
 * `registerType: 'prompt'`, which deliberately does not set `clientsClaim` — a
 * worker that claimed the open page would run `cleanupOutdatedCaches()` under
 * it and delete the precache it was still resolving chunks against. That is the
 * outage that made share links need four or five refreshes.
 *
 * The consequence for a test is that `navigator.serviceWorker.controller` is
 * null on the first navigation no matter how long you wait for it. So: wait for
 * the registration to become *active*, reload, and only then expect a
 * controller. Checking control on the first load is how this spec first
 * reported "no service worker" against a build that had one.
 */
async function ensureServiceWorkerControls(page: Page): Promise<boolean> {
  if (!(await serviceWorkerReady(page))) return false

  await page.reload()
  // Settle the new document before polling it: `waitForFunction` evaluates in a
  // page context, and starting it across a reload races the context swap.
  await page.waitForLoadState('domcontentloaded')

  return await page
    .waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 20_000,
    })
    .then(() => true)
    .catch(() => false)
}

/**
 * A service worker controls the page (`ensureServiceWorkerControls`), or the
 * test ends: skipped on a dev server, where vite-plugin-pwa emits no worker,
 * and failed in CI. Never skippable in CI: unconditional, the skip went silent
 * exactly when the thing it proves broke, nightly green with the offline
 * guarantee unverified. The assertion says WHY the rest would fail: without
 * it the first thing to break is `page.reload()` under `setOffline(true)`,
 * which reads as a network fault and never names the worker.
 */
async function requireServiceWorker(page: Page): Promise<void> {
  const controlled = await ensureServiceWorkerControls(page)
  test.skip(
    !controlled && !process.env.CI,
    'No service worker controls the page — this is a dev-server run, where vite-plugin-pwa emits none. Runs for real against the CI preview build.'
  )
  expect(controlled, 'no service worker took control of the page').toBe(true)
}

test.describe('the one install', { tag: '@pr' }, () => {
  // Anonymous on purpose: a visitor's install, opened at the reference's root.
  test.use({ account: 'anonymous', serviceWorkers: 'allow' })

  test('opened at /, the reference and the app both open offline', async ({ page, context }) => {
    await page.goto('/')
    const active = await serviceWorkerReady(page)
    test.skip(
      !active && !process.env.CI,
      'No service worker: this is a dev-server run. Runs for real against the CI preview build.'
    )
    expect(active, 'no service worker became active').toBe(true)
    // With no app tab open, the worker claims the page it installed from.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 20_000,
    })

    await context.setOffline(true)
    try {
      await page.goto(at('/'))
      await expect(page.locator('#root')).not.toBeEmpty()
      await expect(page).toHaveTitle(/Training Bay/i)

      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page).toHaveTitle(/Salvage Union/i)
    } finally {
      await context.setOffline(false)
    }
  })
})

test.describe('signed out: the shell', { tag: '@pr' }, () => {
  // Anonymous on purpose: these are about the offline shell a visitor gets.
  test.use({ account: 'anonymous', serviceWorkers: 'allow' })

  test('the app opens and reads with the network cut', async ({ page, context }) => {
    await openApp(page, '/')

    await requireServiceWorker(page)

    // Cut the network at the browser, not the app: `setOffline` fails real
    // requests, which is what a service worker either answers from cache or does
    // not. Toggling a flag inside the app would prove nothing about the worker.
    await context.setOffline(true)

    await page.reload()
    await waitForReady(page)

    // The shell renders from cache. This is the whole promise: an installed app
    // opens with no network.
    await expect(page).toHaveTitle(/SalvageUnion\.io/)
    await expect(page.getByRole('heading', { level: 1, name: /^Training Bay$/i })).toBeVisible()

    await context.setOffline(false)
  })

  test('an unvisited route also resolves offline — the shell is not one page', async ({
    page,
    context,
  }) => {
    await openApp(page, '/')

    await requireServiceWorker(page)

    await context.setOffline(true)

    // The app is a SPA, so every route is the same document. That is exactly why
    // this is worth asserting rather than assuming: it is what distinguishes
    // the app's offline story from `srd`'s, where an unvisited page genuinely 404s
    // offline because each one is its own HTML file (ADR-034 decision 3).
    // A REAL route this test has not visited: the SPA shell must serve it from
    // cache and route it. (A route that does not exist would assert only that
    // the offline not-found page carries the app title.)
    await page.goto(at('/starter'))
    await waitForReady(page)
    await expect(page).toHaveTitle(/SalvageUnion\.io/)
    await expect(page.getByText(/page not found/i)).toHaveCount(0)

    await context.setOffline(false)
  })
})

test.describe('signed in: what a player keeps', { tag: '@pr' }, () => {
  /**
   * Mid-session: the sheet a player has open survives the network
   * dropping. Writes are blocked, not queued (ADR-030 §1), so the sheet leaves
   * Edit and its Read | Edit toggle goes; it comes back with the connection.
   * No worker is involved, so this runs with service workers blocked, on the
   * dev server too.
   */
  test('the open sheet stays up, read-only, when the network drops mid-session', async ({
    page,
    context,
  }) => {
    await buildPilot(page, 'Offline Keeper', 'Lantern')
    await openSheetFor(page, 'Offline Keeper')
    await editSheet(page)

    await context.setOffline(true)

    await expect(page.getByText('Not connected — your Games are read-only')).toBeVisible()
    await expect(page.getByText('Offline Keeper').first()).toBeVisible()
    await expect(page.getByRole('group', { name: /read or edit this/i })).toHaveCount(0)

    await context.setOffline(false)

    await expect(page.getByText('Not connected — your Games are read-only')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  })

  /**
   * What is kept (ADR-053): the device copy. An offline reload boots the
   * precached shell, and the player's own sheets come back from the copy
   * `ShelfSync` saved, read-only under the NOT CONNECTED banner; with the
   * connection back the sheet is editable again.
   */
  test.describe(() => {
    test.use({ serviceWorkers: 'allow' })

    test('an offline reload brings their sheets back from the device, read-only', async ({
      page,
      context,
    }) => {
      await buildPilot(page, 'Kept On This Device', 'Ember')
      await openSheetFor(page, 'Kept On This Device')
      await requireServiceWorker(page)
      await expect(page.getByText('Kept On This Device').first()).toBeVisible()

      await context.setOffline(true)
      try {
        await page.reload()
        await waitForReady(page)

        await expect(page).toHaveTitle(/SalvageUnion\.io/)
        // DIAGNOSTIC (temporary): what the offline reload booted with.
        await page.waitForTimeout(3000)
        console.log(
          'OFFLINE-DIAG',
          JSON.stringify(
            await page.evaluate(() => ({
              onLine: navigator.onLine,
              url: location.href,
              controlled: Boolean(navigator.serviceWorker?.controller),
              keys: Object.keys(localStorage),
              jwt: Object.keys(localStorage)
                .filter((k) => k.startsWith('__convexAuthJWT'))
                .map((k) => (localStorage.getItem(k) ?? '').split('.')[1]?.length),
              body: document.body.innerText.slice(0, 600),
            }))
          )
        )
        await expect(page.getByText('Not connected — your Games are read-only')).toBeVisible()
        await expect(page.getByText('Kept On This Device').first()).toBeVisible()
        await expect(page.getByRole('group', { name: /read or edit this/i })).toHaveCount(0)

        // The Training Bay lists it too: the copy is the roster, not one page.
        await page.goto(at('/'))
        await waitForReady(page)
        await expect(sheetLink(page, 'Kept On This Device')).toBeVisible()
      } finally {
        await context.setOffline(false)
      }

      await expect(page.getByText('Not connected — your Games are read-only')).toHaveCount(0)
    })
  })
})
