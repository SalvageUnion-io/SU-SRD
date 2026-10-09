import { expect, test } from '@playwright/test'
import { scanAgainstBaseline } from '../../../tools/lib/a11yScan'

/**
 * WCAG 2.2 AA on every route in `tools/a11y-baseline-itun.json`, signed out,
 * at desktop and as a Pixel 7 (`tools/lib/a11yScan.ts`). Fails on a violation
 * the baseline does not accept, and on a baseline entry that no longer fires.
 */

// One test owns every route, because a stale entry is judged on the whole run;
// and a violation that fires only sometimes must not pass on a retry.
test.describe.configure({ retries: 0 })

test('no accessibility violation outside the baseline', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(10 * 60_000)
  const { results, regressions, stale } = await scanAgainstBaseline({
    browser,
    baseURL: baseURL ?? '',
    baselineFile: 'a11y-baseline-itun.json',
    // The reference-data gate's loading screen has no <main>.
    ready: 'main',
  })
  await testInfo.attach('a11y-report.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  expect
    .soft(regressions, 'new violations: fix each, or accept it in the baseline with a reason')
    .toEqual([])
  expect(stale, 'stale entries: re-run with A11Y_UPDATE_BASELINE=1 to delete them').toEqual([])
})
