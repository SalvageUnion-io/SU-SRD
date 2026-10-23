import { scanPages } from 'gates/a11y'
import { expectNoA11yViolations } from './_a11y'
import { at } from './_base'
import { test } from './fixtures'

/**
 * WCAG 2.2 AA on every route in `PAGES`, signed out, at desktop and as a
 * Pixel 7 (`packages/gates/lib/a11yScan.ts`). Fails on any violation. The
 * pages only an account reaches are `a11y-signed-in.e2e.ts`'s, nightly.
 */

/**
 * The anonymous routes (app paths; `at` puts them on the site) a build with no Convex backend can render — the same
 * build the PR-blocking smoke specs run against.
 */
const PAGES = [
  '/',
  '/pilots/new',
  '/mechs/new',
  '/crawlers/new',
  '/patterns/',
  '/settings',
  '/starter',
  // The Starter Set sheets, one of each kind: a sheet's one <main> and its
  // sticky bar, which is no second banner.
  '/starter/pilot/starter-pilot-bonesaw',
  '/starter/mech/starter-mech-scrapper',
  '/starter/crawler/starter-crawler-tenacity',
  // Play as a signed-out visitor meets it: the landing, and each Play
  // screen's sign-in refusal (`PlayGate`, `PlayMediatorGate`). The signed-in
  // states are `play-*.e2e.ts`'s.
  '/play/',
  '/play/pilots/a11y-probe',
  '/play/games/a11y-probe/mediate',
]

// A violation that fires only sometimes must not pass on a retry.

// What any visitor sees: nothing here needs an account.
test.use({ account: 'anonymous' })

test.describe.configure({ retries: 0 })

test('no accessibility violations', { tag: '@pr' }, async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(10 * 60_000)
  const scan = await scanPages({
    browser,
    baseURL: baseURL ?? '',
    pages: PAGES.map(at),
    // The reference-data gate's loading screen has no <main>.
    ready: 'main',
  })
  await expectNoA11yViolations(testInfo, scan)
})
