import type { TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import type { scanPages } from 'gates/a11y'

/**
 * Hold an axe scan (`scanPages`, `gates/a11y`) to zero violations, with the
 * full results attached to the report as `a11y-report.json` for the details.
 * Every a11y spec ends this way.
 */
export async function expectNoA11yViolations(
  testInfo: TestInfo,
  { results, violations }: Awaited<ReturnType<typeof scanPages>>
): Promise<void> {
  await testInfo.attach('a11y-report.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  expect(
    violations,
    'accessibility violations: the attached a11y-report.json has the details'
  ).toEqual([])
}
