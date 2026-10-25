import type { Page } from '@playwright/test'
import { sheetLink } from 'gates/lib/appPage'
import { at } from './_base'
import { buildMech, buildPilot, editSheet, openApp, openSheetFor, waitForReady } from './_helpers'
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
 * The device copy (`docs/ARCHITECTURE.md#device-copy`) keeps the signed-in
 * player's own rows, and the outbox (ADR-063) keeps the edits they make to
 * them offline. So offline promises three things, and this spec pins them:
 *
 *  - **Mid-session**, a signed-in player's open sheet stays on screen under
 *    the bar's sync badge, and still edits. No worker is involved.
 *  - **After a reload**, the shell boots from the worker's precache and the
 *    player's own sheets come back from the device copy, with the edits still
 *    waiting folded over them.
 *  - **On reconnect**, the outbox goes up and the server holds the edits.
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
 * deliberate trade documented in `astro.config.ts` — claiming the open page is
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
   * Mid-session: the sheet a player has open survives the network dropping,
   * and their own sheet keeps its Read | Edit toggle: its edits wait in the
   * outbox (ADR-063). No worker is involved, so this runs with service
   * workers blocked, on the dev server too.
   */
  test('the open sheet stays up, and editable, when the network drops mid-session', async ({
    page,
    context,
  }) => {
    await buildPilot(page, 'Offline Keeper', 'Lantern')
    await openSheetFor(page, 'Offline Keeper')
    await editSheet(page)

    await context.setOffline(true)

    await expect(page.getByRole('status', { name: /Not connected/ })).toBeVisible()
    await expect(page.getByText('Offline Keeper').first()).toBeVisible()
    await expect(page.getByRole('group', { name: /read or edit this/i })).toBeVisible()

    await context.setOffline(false)

    await expect(page.getByRole('status', { name: /Not connected/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  })

  /**
   * What is kept: the device copy and the outbox (ADR-063). Offline, the
   * player takes a point of HP off their pilot and spends a point of EP on
   * their mech. An offline reload boots the precached shell, and both sheets
   * come back from the copy with those edits folded over them. With the
   * connection back the outbox goes up, and the server holds both.
   */
  test.describe(() => {
    test.use({ serviceWorkers: 'allow' })

    test('edits made offline survive a reload and reach the server on reconnect', async ({
      page,
      context,
    }) => {
      await buildMech(page, 'Outbox Mule')
      await buildPilot(page, 'Kept On This Device', 'Ember')
      await openSheetFor(page, 'Kept On This Device')
      await requireServiceWorker(page)
      await expect(page.getByText('Kept On This Device').first()).toBeVisible()

      // CI's headless Chromium keeps `navigator.onLine` true on a document
      // loaded while the context is offline, where a real browser reports
      // false, so the reload is told the truth through the same getter.
      await page.addInitScript(() => {
        if (sessionStorage.getItem('e2e:offline') === 'on') {
          Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false })
        }
      })
      await page.evaluate(() => sessionStorage.setItem('e2e:offline', 'on'))
      await context.setOffline(true)
      let hp = 0
      let ep = 0
      try {
        await expect(page.getByRole('status', { name: /Not connected/ })).toBeVisible()
        hp = (await stepDown(page, 'Kept On This Device', 'HP')) - 1
        ep = (await stepDown(page, 'Outbox Mule', 'EP')) - 1

        await page.reload()
        await waitForReady(page)
        await expect(page).toHaveTitle(/SalvageUnion\.io/)
        await expect(page.getByRole('status', { name: /Not connected/ })).toBeVisible()
        await expectVital(page, 'Outbox Mule', 'EP', ep)
        await expectVital(page, 'Kept On This Device', 'HP', hp)

        // The Training Bay lists it too: the copy is the roster, not one page.
        await page.goto(at('/'))
        await waitForReady(page)
        await expect(sheetLink(page, 'Kept On This Device')).toBeVisible()
      } finally {
        await context.setOffline(false)
        await page.evaluate(() => sessionStorage.removeItem('e2e:offline'))
      }

      await page.reload()
      await waitForReady(page)
      await expect(page.getByRole('status', { name: /Not connected/ })).toHaveCount(0)
      // Sent: the outbox empties once the server has answered every op…
      await expect.poll(() => outboxLength(page), { timeout: 20_000 }).toBe(0)
      // …so what the sheets show now is the server's.
      await expectVital(page, 'Kept On This Device', 'HP', hp)
      await expectVital(page, 'Outbox Mule', 'EP', ep)
    })
  })
})

/** Open `name`'s sheet in Edit and take one point off `vital`; answers the value before. */
async function stepDown(page: Page, name: string, vital: string): Promise<number> {
  await openSheetFor(page, name)
  await editSheet(page)
  const gauge = page.getByRole('slider', { name: vital, exact: true }).first()
  const before = Number(await gauge.getAttribute('aria-valuenow'))
  expect(before, `${name}'s ${vital} should start above 0`).toBeGreaterThan(0)
  await gauge.press('ArrowLeft')
  await expect(gauge).toHaveAttribute('aria-valuenow', String(before - 1))
  return before
}

/** `name`'s sheet shows `vital` at `value`. */
async function expectVital(page: Page, name: string, vital: string, value: number): Promise<void> {
  await openSheetFor(page, name)
  await editSheet(page)
  const gauge = page.getByRole('slider', { name: vital, exact: true }).first()
  await expect(gauge).toHaveAttribute('aria-valuenow', String(value))
}

/** How many edits wait in the device's outbox (`replica/persist.ts`). */
function outboxLength(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('su-replica')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('meta')) return resolve(0)
          const get = db.transaction('meta').objectStore('meta').get('outbox')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => resolve(get.result?.writes?.length ?? 0)
        }
      })
  )
}
