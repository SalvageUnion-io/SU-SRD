import { scanPages } from 'gates/a11y'
import { SEED_KEYS, seedAccount } from 'gates/lib/seedAccount'
import { expectNoA11yViolations } from './_a11y'
import { at } from './_base'
import { test } from './fixtures'

/**
 * WCAG 2.2 AA on the pages only an account reaches, at desktop and as a
 * Pixel 7 (`packages/gates/lib/a11yScan.ts`). Fails on any violation.
 *
 * `app-a11y.e2e.ts` scans signed out, where the app is read-only: the Training Bay, the
 * wizards, the live sheets, the Game and Play never render there. This spec
 * signs in through the fixtures account (`fixtures.ts`), seeds it as the
 * layout gates' walk does (`gates/lib/seedAccount.ts`), and scans with that
 * session the Training Bay, each wizard's first step, and every page the
 * seed made: each kind's sheet, the Game and its invite, the Play hub, and
 * Play's player, solo and Mediator screens as they open (On foot, Scene).
 * Play's other states (Boarded, Downtime) are the server's, not a URL's, so
 * the specs that reach them scan them live (`axeViolations`):
 * `play-turn.e2e.ts`, `play-solo.e2e.ts` and `play-mediator.e2e.ts`.
 *
 * Like every signed-in spec it SKIPS in a build with no test sign-in seam. The
 * PR tier's build carries the seam but this spec is not tagged `@pr`; the nightly
 * `e2e` job runs it.
 */

// A violation that fires only sometimes must not pass on a retry.
test.describe.configure({ retries: 0 })

test('no accessibility violations signed in', async ({ page, browser, baseURL }, testInfo) => {
  test.setTimeout(15 * 60_000)
  const seed = await seedAccount(page)

  // The scan opens a context per device; each starts with this session.
  const storageState = await page.context().storageState({ indexedDB: true })
  const scan = await scanPages({
    browser,
    baseURL: baseURL ?? '',
    pages: [
      // The Training Bay, with the account's Game and units on it.
      at('/'),
      // Each wizard's first step.
      at('/pilots/new?mode=guided'),
      at('/mechs/new?mode=guided'),
      at('/crawlers/new?mode=guided'),
      at('/npcs/new'),
      at('/play/'),
      ...SEED_KEYS.map((key) => seed[key]),
    ],
    // The reference-data gate's loading screen has no <main>.
    ready: 'main',
    storageState,
  })
  await expectNoA11yViolations(testInfo, scan)
})
