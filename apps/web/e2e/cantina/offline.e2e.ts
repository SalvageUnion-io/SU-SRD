import type { Page } from '@playwright/test'
import { at } from './_base'
import { buildPilot, editSheet, openSheetFor, waitForReady } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Offline — the one spec that proves the Cantina is actually a PWA rather than merely
 * configured as one, and that pins what offline means for a player's data.
 *
 * ADR-034 decision 3 says an installed app works offline. The app ships a
 * service worker and a manifest, and this is the spec that exercises them —
 * the root Playwright config blocks service workers for every other spec.
 *
 * ## What offline promises
 *
 * There is no device cache (`docs/ARCHITECTURE.md#no-device-cache`): nothing
 * player-owned is kept on the device. So offline promises two things, and this
 * spec pins both:
 *
 *  - **Mid-session**, a signed-in player's open sheet stays on screen,
 *    read-only, under the NOT CONNECTED banner. The rows are this page load's
 *    in-memory copy; no worker is involved.
 *  - **After a reload**, the shell boots from the worker's precache, and
 *    nothing of the player's comes back: there is no device copy to read.
 *    Reading sheets after an offline reload is deliberately not a requirement.
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
 * **A first load is never controlled, and that is by design.** The Cantina runs
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
async function ensureServiceWorkerControls(
  page: import('@playwright/test').Page
): Promise<boolean> {
  // `page.evaluate` genuinely awaits a returned promise. `page.waitForFunction`
  // does NOT for an async predicate — it sees the Promise object, finds it
  // truthy, and resolves on the first poll. Using it here made this helper
  // return "registered" at ~0ms, reload before the worker had activated, and
  // then skip every test as though the build had no service worker at all.
  const registered = await page
    .evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      // `ready` resolves once a registration is ACTIVE for this scope, which is
      // the state the reload below needs in order to be controlled.
      //
      // Raced against a timer because on a dev server there is no worker to
      // become ready and `ready` simply never settles — an un-raced await would
      // hang until the whole test timed out, turning "this environment has no
      // service worker" into a red test instead of a skip.
      const ready = navigator.serviceWorker.ready.then(() => true)
      const gaveUp = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 15_000)
      })
      return await Promise.race([ready, gaveUp])
    })
    .catch(() => false)

  if (!registered) return false

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

/** Skip on a dev server, fail in CI: see the first anonymous test for why. */
async function requireServiceWorker(page: Page): Promise<void> {
  const controlled = await ensureServiceWorkerControls(page)
  test.skip(
    !controlled && !process.env.CI,
    'No service worker controls the page — this is a dev-server run, where vite-plugin-pwa emits none. Runs for real against the CI preview build.'
  )
  expect(controlled, 'no service worker took control of the page').toBe(true)
}

test.describe('signed out: the shell', () => {
  // Anonymous on purpose: these are about the offline shell a visitor gets.
  test.use({ account: 'anonymous', serviceWorkers: 'allow' })

  test('the app opens and reads with the network cut', async ({ page, context }) => {
    await page.goto(at('/'))
    await waitForReady(page)

    const controlled = await ensureServiceWorkerControls(page)
    // NOT skippable in CI. The convenience of skipping on a dev-server run, where
    // vite-plugin-pwa emits no worker, is worth keeping — but unconditional it
    // meant this spec went silent exactly when the thing it proves broke. If the
    // worker stops registering or activating, `controlled` is false, both tests
    // here skip, and nightly is green with the offline guarantee unverified.
    test.skip(
      !controlled && !process.env.CI,
      'No service worker controls the page — this is a dev-server run, where vite-plugin-pwa emits none. Runs for real against the CI preview build.'
    )
    // In CI the skip above does not fire, so say WHY the rest is about to fail.
    // Without this the first thing to break is `page.reload()` under
    // `setOffline(true)`, which throws `net::ERR_INTERNET_DISCONNECTED` — that
    // reads as a network or proxy fault, and nothing in the output mentions the
    // service worker at all. The point of running this in CI is to learn that the
    // worker stopped controlling the page; the failure has to say so.
    expect(controlled, 'no service worker took control of the page').toBe(true)

    // Cut the network at the browser, not the app: `setOffline` fails real
    // requests, which is what a service worker either answers from cache or does
    // not. Toggling a flag inside the app would prove nothing about the worker.
    await context.setOffline(true)

    await page.reload()
    await waitForReady(page)

    // The shell renders from cache. This is the whole promise: an installed app
    // opens with no network.
    await expect(page).toHaveTitle(/SalvageUnion\.io/)
    await expect(page.getByRole('heading', { level: 1, name: /^The Cantina$/i })).toBeVisible()

    await context.setOffline(false)
  })

  test('an unvisited route also resolves offline — the shell is not one page', async ({
    page,
    context,
  }) => {
    await page.goto(at('/'))
    await waitForReady(page)

    const controlled = await ensureServiceWorkerControls(page)
    // See the note on the first test: the skip is a local convenience only, and
    // the assertion is what makes a CI failure legible.
    test.skip(
      !controlled && !process.env.CI,
      'No service worker controls the page — dev-server run.'
    )
    expect(controlled, 'no service worker took control of the page').toBe(true)

    await context.setOffline(true)

    // The Cantina is a SPA, so every route is the same document. That is exactly why
    // this is worth asserting rather than assuming: it is what distinguishes
    // The Cantina's offline story from `srd`'s, where an unvisited page genuinely 404s
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

test.describe('signed in: what a player keeps', () => {
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
   * What is not kept, pinned so it is not quietly half-restored: an offline
   * reload boots the precached shell, and the player's rows do not come back,
   * because nothing kept them.
   */
  test.describe(() => {
    test.use({ serviceWorkers: 'allow' })

    test('an offline reload boots the shell and brings back none of their rows', async ({
      page,
      context,
    }) => {
      await buildPilot(page, 'Not On This Device', 'Ember')
      await openSheetFor(page, 'Not On This Device')
      await requireServiceWorker(page)
      await expect(page.getByText('Not On This Device').first()).toBeVisible()

      await context.setOffline(true)
      await page.reload()
      await waitForReady(page)

      await expect(page).toHaveTitle(/SalvageUnion\.io/)
      await expect(page.getByText('Not On This Device')).toHaveCount(0)

      await context.setOffline(false)
    })
  })
})
