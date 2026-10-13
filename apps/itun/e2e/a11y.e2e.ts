import { expect, test } from '@playwright/test'
import { scanPages } from 'gates/a11y'
import { at } from './_base'

/**
 * WCAG 2.2 AA on every route in `PAGES`, signed out, at desktop and as a
 * Pixel 7 (`packages/gates/lib/a11yScan.ts`). Fails on any violation.
 */

/**
 * The anonymous routes (app paths; `at` puts them under `/build`) a build with no Convex backend can render — the same
 * build the PR-blocking smoke specs run against.
 */
const PAGES = [
  '/',
  '/about',
  '/changelog',
  '/pilots/new',
  '/mechs/new',
  '/crawlers/new',
  '/mechs/patterns',
  '/settings',
  '/starter',
  // A sheet: its one <main> and its sticky bar, which is no second banner.
  '/starter/pilot/starter-pilot-bonesaw',
]

// A violation that fires only sometimes must not pass on a retry.
test.describe.configure({ retries: 0 })

test('no accessibility violations', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(10 * 60_000)
  const { results, violations } = await scanPages({
    browser,
    baseURL: baseURL ?? '',
    pages: PAGES.map(at),
    // The reference-data gate's loading screen has no <main>.
    ready: 'main',
  })
  await testInfo.attach('a11y-report.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  expect(
    violations,
    'accessibility violations: the attached a11y-report.json has the details'
  ).toEqual([])
})
