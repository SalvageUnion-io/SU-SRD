import type { Page } from '@playwright/test'
import { buildPilot, gotoStable, waitForReady } from './_helpers'
import { expect, requireSeam, seamIsPresent, signInFresh, test } from './fixtures'

// Anonymous on purpose: it starts signed out, and signs in mid-test.
test.use({ account: 'anonymous' })

/**
 * Sign in → build → save (ADR-034 decision 1, as amended).
 *
 * Signed out, ITUN is read-only: a visitor who opens a wizard is asked to sign
 * in instead, so there is never unsaved anonymous work to hand off. This pins
 * both halves — the refusal, and that what is built after signing in is
 * durable — and it is the reason the test-only password provider exists. Without this spec that provider
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
 * container destroyed with the runner, so it needs no credentials and never
 * puts a password provider on production. The same seam now signs in every
 * other durable spec too (`fixtures.ts`), since the anonymous backend is
 * in-memory everywhere.
 *
 * That job sets `ITUN_E2E_EXPECT_AUTH_SEAM`, which turns the skip into a throw.
 *
 * Run it for real against the local backend (one-time setup: "Local backend"
 * in `apps/itun/README.md`). Playwright reuses a running `bun run dev:itun`,
 * which carries all three:
 *
 *   bun --filter itun exec playwright test signin-save.e2e.ts
 */

/**
 * How many pilots this origin's IndexedDB holds — the signed-in cache, which a
 * build reaches only once the server of record has taken it.
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

test('a signed-out visitor is asked to sign in, and what they build then is saved', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await waitForReady(page)

  // Skips in an ordinary build, THROWS in a run that provisioned the seam —
  // see `fixtures.ts`. Historical note, because it is the reason the throw
  // exists: for a long time no workflow set any of the three variables, so this
  // spec skipped everywhere including nightly while reading as coverage.
  requireSeam(await seamIsPresent(page), testInfo)

  // Signed out, the wizard is a sign-in panel: nothing can be built.
  await gotoStable(page, '/pilots/new')
  await waitForReady(page)
  await expect(page.getByRole('heading', { name: 'Sign in to build a pilot' })).toBeVisible()
  await expect(page.getByRole('button', { name: /guided/i })).toHaveCount(0)
  expect(await cachedPilotCount(page)).toBe(0)

  await signInFresh(page)
  await buildPilot(page, 'Saved By Signing In', 'Keeper')
  await expect.poll(() => cachedPilotCount(page), { timeout: 30_000 }).toBeGreaterThan(0)

  // Reload to prove it is DURABLE — on the server, not merely in this tab.
  await page.reload()
  await waitForReady(page)
  // The roster is `/` (`src/routes/index.tsx`); there is no `/roster` route.
  await gotoStable(page, '/')
  await waitForReady(page)

  await expect(page.getByRole('heading', { name: /Saved Builds/i })).toBeVisible()
  await expect(page.getByText('Saved By Signing In').first()).toBeVisible()
})
