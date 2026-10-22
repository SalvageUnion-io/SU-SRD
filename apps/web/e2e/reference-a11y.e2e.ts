import { scanPages } from 'gates/a11y'
import { expectNoA11yViolations } from './_a11y'
import { test } from './fixtures'

/**
 * WCAG 2.2 AA on every page in `PAGES`, at desktop and as a Pixel 7
 * (`packages/gates/lib/a11yScan.ts`). Fails on any violation.
 */

/** One of each page shape the SSG renders. */
const PAGES = [
  '/',
  '/about/',
  '/api/',
  '/bot/',
  '/bot/terms/',
  '/bot/privacy/',
  '/chassis/',
  '/chassis/aegis/',
  '/roll-tables/ai-personality/',
  '/guides/activating-and-shutting-down-a-mech/',
]

test.use({ account: 'anonymous' })

// A violation that fires only sometimes must not pass on a retry.
test.describe.configure({ retries: 0 })

test('no accessibility violations', { tag: '@pr' }, async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(10 * 60_000)
  await expectNoA11yViolations(
    testInfo,
    await scanPages({ browser, baseURL: baseURL ?? '', pages: PAGES })
  )
})
