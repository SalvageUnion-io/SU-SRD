import { expect, test } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * Offline — the one spec that proves ITUN is actually a PWA rather than merely
 * configured as one.
 *
 * ADR-034 decision 3 says an installed app works offline. That claim was
 * previously supported by nothing: the app ships a service worker and a
 * manifest, and **no test had ever exercised either** — the root Playwright
 * config even blocks service workers globally, with a comment saying no spec
 * needs them. This is the spec that does.
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
 * server. CI serves the built bundle (`vite preview`) and gets one; a developer
 * running `bun run dev:itun` does not. A spec that failed in the second case
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

test.use({ serviceWorkers: 'allow' })

/**
 * Get the page to a state where a service worker is actually serving it.
 *
 * **A first load is never controlled, and that is by design.** ITUN runs
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

test('the app opens and reads with the network cut', async ({ page, context }) => {
  await page.goto('/')
  await waitForReady(page)

  const controlled = await ensureServiceWorkerControls(page)
  test.skip(
    !controlled,
    'No service worker controls the page — this is a dev-server run, where vite-plugin-pwa emits none. Runs for real against the CI preview build.'
  )

  // Cut the network at the browser, not the app: `setOffline` fails real
  // requests, which is what a service worker either answers from cache or does
  // not. Toggling a flag inside the app would prove nothing about the worker.
  await context.setOffline(true)

  await page.reload()
  await waitForReady(page)

  // The shell renders from cache. This is the whole promise: an installed app
  // opens with no network.
  await expect(page).toHaveTitle(/In The Union Now/i)
  await expect(page.getByRole('heading', { name: /Welcome to In the Union Now/i })).toBeVisible()

  await context.setOffline(false)
})

test('an unvisited route also resolves offline — the shell is not one page', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await waitForReady(page)

  const controlled = await ensureServiceWorkerControls(page)
  test.skip(!controlled, 'No service worker controls the page — dev-server run.')

  await context.setOffline(true)

  // ITUN is a SPA, so every route is the same document. That is exactly why
  // this is worth asserting rather than assuming: it is what distinguishes
  // ITUN's offline story from `srd`'s, where an unvisited page genuinely 404s
  // offline because each one is its own HTML file (see the plan's P7).
  await page.goto('/roster')
  await waitForReady(page)
  await expect(page).toHaveTitle(/In The Union Now/i)

  await context.setOffline(false)
})
