import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { scanPages } from 'gates/a11y'

/**
 * WCAG 2.2 AA on every story the catalog serves, each alone on its canvas
 * (`?story=<id>&mode=canvas`), at desktop and as a Pixel 7
 * (`packages/gates/lib/a11yScan.ts`).
 *
 * The list is `bun run stories:ids`, so a new story is scanned the day it is
 * written. Playwright runs specs under Node, and `listStories.ts` reads the
 * story files with Bun, so it runs as its own process.
 *
 * A ratchet, against `tools/baselines/stories-a11y-baseline.json`: the axe
 * rules each story failed on the day this spec landed. A story fails on any
 * rule its entry does not list, and on any rule it lists that now passes, so
 * the entry is cut in the commit that fixes it. The baseline only shrinks: a
 * new story, or a rule a story did not fail before, has no entry to hide in.
 */
const CATALOG = fileURLToPath(new URL('..', import.meta.url))

const STORIES = execFileSync('bun', ['listStories.ts'], { cwd: CATALOG, encoding: 'utf8' })
  .trim()
  .split('\n')
  .map((line) => {
    const [id = '', path = ''] = line.split('\t')
    return { id, path }
  })

const BASELINE_FILE = 'tools/baselines/stories-a11y-baseline.json'
const BASELINE: Record<string, string[]> = JSON.parse(
  readFileSync(new URL(`../../../${BASELINE_FILE}`, import.meta.url), 'utf8')
).stories

/**
 * A story is a component, not a page: the canvas wraps it in the catalog's
 * one `<main>`, and it has no page title or `<h1>` of its own. These rules
 * judge a whole page's landmarks and headings, so they say nothing about a
 * story. Every other rule runs. The apps' own scans hold them on real pages.
 */
const PAGE_ONLY_RULES = [
  'region',
  'page-has-heading-one',
  'landmark-one-main',
  'landmark-no-duplicate-main',
  'landmark-main-is-top-level',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-contentinfo',
  'landmark-banner-is-top-level',
  'landmark-contentinfo-is-top-level',
  'landmark-complementary-is-top-level',
  'landmark-unique',
]

/**
 * Stories per test. Each batch is its own test, so Playwright's workers scan
 * batches side by side and a failure names the batch it came from.
 */
const BATCH = 24

// A violation that fires only sometimes must not pass on a retry.
test.describe.configure({ retries: 0 })

test('stories:ids lists stories, and the baseline names only those', () => {
  expect(STORIES.length).toBeGreaterThan(0)
  const ids = new Set(STORIES.map((s) => s.id))
  expect(
    Object.keys(BASELINE).filter((id) => !ids.has(id)),
    `${BASELINE_FILE} names stories the catalog no longer has: remove them`
  ).toEqual([])
})

for (let start = 0; start < STORIES.length; start += BATCH) {
  const batch = STORIES.slice(start, start + BATCH)
  test(`stories ${start + 1}-${start + batch.length} hold their a11y baseline`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(10 * 60_000)
    const { results } = await scanPages({
      browser,
      baseURL: baseURL ?? '',
      pages: batch.map((s) => s.path),
      // The canvas's `<main>` names its story once the story modules have loaded.
      ready: 'main[data-story-id]',
      disableRules: PAGE_ONLY_RULES,
      // The skeletons' own stories are nothing but a loading state.
      skeletonIsContent: true,
    })
    await testInfo.attach('a11y-report.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    })

    const failures: string[] = []
    for (const { id, path } of batch) {
      const scans = results.filter((r) => r.page === path)
      // A crashed scan is -1. It must never read as "no violations".
      for (const { device } of scans.filter((r) => r.violations < 0))
        failures.push(`${id} (${device}): the scan itself failed`)
      const failing = new Set(scans.flatMap((r) => r.details.map((d) => d.id)))
      const known = new Set(BASELINE[id] ?? [])
      for (const rule of failing)
        if (!known.has(rule)) failures.push(`${id}: ${rule} (a new violation: fix it)`)
      for (const rule of known)
        if (!failing.has(rule) && scans.every((r) => r.violations >= 0))
          failures.push(`${id}: ${rule} passes now: remove it from ${BASELINE_FILE}`)
    }
    expect(failures, 'the attached a11y-report.json has the details').toEqual([])
  })
}
