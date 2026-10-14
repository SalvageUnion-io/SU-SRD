import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import type { Browser } from '@playwright/test'
import { expect, test } from '@playwright/test'
import type { Budget, LayoutShift, LongTask, Vitals } from 'gates/lib/webVitals'
import {
  cumulativeLayoutShift,
  medianVitals,
  overBudget,
  totalBlockingTime,
  vitalsTable,
} from 'gates/lib/webVitals'

/**
 * Performance budget: LCP, TBT and CLS on one page of each shape, loaded the
 * way Lighthouse's mobile devtools mode loads it (a 412 px phone, slow 4G,
 * a 4x slower CPU), each the median of `RUNS` cold loads after one
 * unthrottled warm-up.
 * It fails a PR that makes one of these pages measurably slower.
 *
 * Budgets are the medians CI's runner measured (LCP 1.84–2.3 s, TBT 0, CLS 0),
 * plus about 30% LCP headroom for runner noise: they catch a regression, not a
 * wobble. A slower machine (a laptop, a cloud container) measures higher, so
 * read a local failure against its own baseline. When a
 * change makes a page faster, lower its budget in the same PR to lock it in;
 * raise one only on purpose, saying why in the PR.
 *
 * It runs in CI's own `perf-srd` job, split by page across two runners
 * (`--shard`), one page at a time on each (`--workers=1`), so no other test
 * competes for the CPU it measures. Each page's medians land in
 * the job summary and, in Actions, as annotations on the PR.
 */

const RUNS = 3

const PAGES: Record<string, Budget> = {
  '/': { lcp: 2_600, tbt: 250, cls: 0.05 },
  '/abilities/': { lcp: 2_600, tbt: 250, cls: 0.05 },
  '/chassis/mule/': { lcp: 3_000, tbt: 250, cls: 0.05 },
  '/roll-tables/core-mechanic/': { lcp: 2_500, tbt: 250, cls: 0.05 },
}

/**
 * Lighthouse's `mobileSlow4G` as its devtools mode applies it: request
 * latency is the 150 ms RTT times 3.75, and throughput is 90% of nominal.
 */
const NETWORK = {
  offline: false,
  latency: 150 * 3.75,
  downloadThroughput: (1_638.4 * 0.9 * 1_024) / 8,
  uploadThroughput: (675 * 0.9 * 1_024) / 8,
}
const CPU_SLOWDOWN = 4

/** How long the main thread must stay free of long tasks before a load is over. */
const QUIET_MS = 2_000
const SETTLE_TIMEOUT_MS = 20_000

type Raw = { fcp: number; lcp: number; tasks: LongTask[]; shifts: LayoutShift[]; lastTask: number }

type PerfWindow = Window & { __perf: Raw }

/** Buffers every entry from navigation start, before any page script runs. */
function observe() {
  const perf: Raw = { fcp: 0, lcp: 0, tasks: [], shifts: [], lastTask: 0 }
  ;(window as unknown as PerfWindow).__perf = perf
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (entry.name === 'first-contentful-paint') perf.fcp = entry.startTime
  }).observe({ type: 'paint', buffered: true })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) perf.lcp = entry.startTime
  }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver((list) => {
    for (const { startTime, duration } of list.getEntries()) {
      perf.tasks.push({ startTime, duration })
      perf.lastTask = performance.now()
    }
  }).observe({ type: 'longtask', buffered: true })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number
      hadRecentInput: boolean
    })[])
      perf.shifts.push({
        startTime: entry.startTime,
        value: entry.value,
        hadRecentInput: entry.hadRecentInput,
      })
  }).observe({ type: 'layout-shift', buffered: true })
}

async function measure(browser: Browser, url: string, throttle = true): Promise<Vitals> {
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
  })
  try {
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    if (throttle) {
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', NETWORK)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
    }
    await page.addInitScript(observe)
    await page.goto(url, { waitUntil: 'load' })
    // Over once the main thread has been quiet for QUIET_MS, like Lighthouse's TTI.
    await page.waitForFunction(
      (quiet) => {
        const { lastTask, fcp } = (window as unknown as PerfWindow).__perf
        return performance.now() - Math.max(lastTask, fcp) > quiet
      },
      QUIET_MS,
      { timeout: SETTLE_TIMEOUT_MS, polling: 250 }
    )
    const raw = await page.evaluate(() => (window as unknown as PerfWindow).__perf)
    expect(raw.fcp, `${url} painted nothing`).toBeGreaterThan(0)
    expect(raw.lcp, `${url} recorded no LCP`).toBeGreaterThan(0)
    return {
      lcp: raw.lcp,
      tbt: totalBlockingTime(raw.tasks, raw.fcp),
      cls: cumulativeLayoutShift(raw.shifts),
    }
  } finally {
    await context.close()
  }
}

// A retry must not hide a slow run.
test.describe.configure({ retries: 0 })

const SUMMARY_HEADING = '## srd performance budget'

/** Adds the page's row to the job summary, with the table's head before the first. */
function summarise(row: { page: string; measured: Vitals; budget: Budget }) {
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (!summary) return
  const lines = vitalsTable([row]).split('\n')
  const started = existsSync(summary) && readFileSync(summary, 'utf8').includes(SUMMARY_HEADING)
  appendFileSync(
    summary,
    `${(started ? lines.slice(2) : [SUMMARY_HEADING, '', ...lines]).join('\n')}\n`
  )
}

for (const [path, budget] of Object.entries(PAGES)) {
  test(`${path} stays within its performance budget`, async ({ browser, baseURL }) => {
    test.setTimeout(3 * 60_000)
    const url = `${baseURL}${path}`
    // Warm the server and the artwork origin, unthrottled; its numbers are discarded.
    await measure(browser, url, false)
    const runs: Vitals[] = []
    for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, url))
    const measured = medianVitals(runs)
    summarise({ page: path, measured, budget })
    // In Actions the line is an annotation, so the medians show on the PR's checks.
    process.stdout.write(
      `${process.env.GITHUB_ACTIONS ? '::notice title=Performance budget::' : ''}${path}: LCP ${Math.round(measured.lcp)} ms, TBT ${Math.round(measured.tbt)} ms, CLS ${measured.cls.toFixed(3)} ` +
        `(runs: ${runs.map((r) => `${Math.round(r.lcp)}/${Math.round(r.tbt)}/${r.cls.toFixed(3)}`).join(', ')})\n`
    )
    expect(overBudget(path, measured, budget)).toEqual([])
  })
}
