import type { Page } from '@playwright/test'
import { buildPilot, gotoStable, waitForReady } from './_helpers'
import { expect, requireSeam, seamIsPresent, signInFresh, test } from './fixtures'

// Anonymous on purpose: it is the hand-off FROM anonymous, and signs in mid-test.
test.use({ account: 'anonymous' })

/**
 * The anonymous-build → sign-in → save hand-off (ADR-034 decision 1, P1/P3).
 *
 * This is the step most likely to lose somebody's work, and it is the entire
 * reason the test-only password provider exists. Without this spec that provider
 * is an auth surface with no consumer — which is the state it was in until this
 * landed, and is worth remembering if anyone is tempted to delete this file
 * rather than fix it: **deleting the spec means deleting the provider too.**
 *
 * ## What it needs, and why it skips without it
 *
 * Three things have to line up:
 *
 *  - a reachable Convex deployment (`VITE_CONVEX_URL` compiled into the build),
 *  - `ITUN_TEST_AUTH=true` on that deployment, so the `password` provider exists,
 *  - `VITE_TEST_AUTH=true` in the build, so `TestAuthBridge` registers the seam.
 *
 * The ordinary suite builds with none of them, so this skips there with a
 * stated reason rather than failing — the same trade `offline.e2e.ts` makes for
 * the dev-server case: a spec that went red in the ordinary run would be
 * deleted the first time it annoyed somebody.
 *
 * **It runs nightly.** `e2e-itun` in `.github/workflows/e2e-nightly.yml`
 * provides all three against a throwaway self-hosted Convex backend — a
 * container destroyed with the runner, so it needs no credentials, cannot
 * create junk accounts on a shared deployment, and never puts a password
 * provider on production. The same seam now signs in every other durable spec
 * too (`fixtures.ts`), since the anonymous backend is in-memory everywhere.
 *
 * That job sets `ITUN_E2E_EXPECT_AUTH_SEAM`, which turns the skip into a throw.
 *
 * Run it for real with a test deployment:
 *
 *   bunx convex env set ITUN_TEST_AUTH true      # on the test deployment
 *   VITE_TEST_AUTH=true VITE_CONVEX_URL=<url> bun --filter itun build
 *   bun --filter itun exec playwright test signin-save.e2e.ts
 */

/**
 * How many pilots this origin's IndexedDB holds.
 *
 * The one observable sign that the save LANDED: an anonymous build lives in
 * memory, and only a successful `claimLocal` followed by the reconciler's
 * adoption puts it into the signed-in cache. Leaving the page before that is
 * exactly how a player loses the build, so the spec waits for it rather than
 * racing it.
 */
async function cachedPilotCount(page: Page): Promise<number> {
  return await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('itun-v1')
        open.onerror = () => resolve(0)
        open.onsuccess = () => {
          const idb = open.result
          if (!idb.objectStoreNames.contains('pilots')) {
            idb.close()
            resolve(0)
            return
          }
          const req = idb.transaction('pilots').objectStore('pilots').count()
          req.onsuccess = () => {
            idb.close()
            resolve(req.result)
          }
          req.onerror = () => resolve(0)
        }
      })
  )
}

test('work built anonymously survives signing in to save it', async ({ page }, testInfo) => {
  await page.goto('/')
  await waitForReady(page)

  // Skips in an ordinary build, THROWS in a run that provisioned the seam —
  // see `fixtures.ts`. Historical note, because it is the reason the throw
  // exists: for a long time no workflow set any of the three variables, so this
  // spec skipped everywhere including nightly while reading as coverage.
  requireSeam(await seamIsPresent(page), testInfo)

  // Build something anonymously — in memory, since nobody is signed in.
  await buildPilot(page, 'Saved By Signing In', 'Keeper')
  expect(await cachedPilotCount(page)).toBe(0)

  // Sign in the way the banner's button would, mid-session.
  await signInFresh(page)

  // The reconciler sends the tab's work on the backend flip; wait for it to
  // land before leaving the page.
  await expect.poll(() => cachedPilotCount(page), { timeout: 30_000 }).toBeGreaterThan(0)

  // Reload to prove it is DURABLE rather than merely still in memory — the
  // whole distinction ADR-034 draws.
  await page.reload()
  await waitForReady(page)
  // The roster is `/` (`src/routes/index.tsx`). There is no `/roster` route:
  // it renders "Page not found", which is why this spec failed every nightly
  // it ran — and why the version before it, which asserted only that the
  // first-run Welcome heading was ABSENT there, passed without proving a thing.
  await gotoStable(page, '/')
  await waitForReady(page)

  // On the roster (its "Saved Builds" heading renders on every roster, empty
  // or not), and not on its first-run face: an empty roster also shows the
  // Welcome block, so its absence is what rules that out.
  await expect(page.getByRole('heading', { name: /Saved Builds/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Welcome to In the Union Now/i })).toHaveCount(0)
  await expect(page.getByText('Saved By Signing In').first()).toBeVisible()
})
