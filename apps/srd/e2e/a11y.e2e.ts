import { expect, test } from '@playwright/test'
import { scanPages } from 'gates/a11y'

/**
 * WCAG 2.2 AA on every page in `PAGES`, at desktop and as a Pixel 7
 * (`packages/gates/lib/a11yScan.ts`). Fails on any violation.
 */

/** One of each page shape the SSG renders. */
const PAGES = [
  '/',
  '/about/',
  '/api/',
  '/discord/',
  '/bot/terms/',
  '/bot/privacy/',
  '/search/',
  '/chassis/',
  '/chassis/aegis/',
  '/roll-tables/ai-personality/',
  '/guides/activating-and-shutting-down-a-mech/',
]

// A violation that fires only sometimes must not pass on a retry.
test.describe.configure({ retries: 0 })

test('no accessibility violations', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(10 * 60_000)
  const { results, violations } = await scanPages({ browser, baseURL: baseURL ?? '', pages: PAGES })
  await testInfo.attach('a11y-report.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  expect(
    violations,
    'accessibility violations: the attached a11y-report.json has the details'
  ).toEqual([])
})
