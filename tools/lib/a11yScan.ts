/**
 * The WCAG 2.2 AA scan both apps run as a Playwright spec (`e2e/a11y.e2e.ts`):
 * axe-core over every page keyed in the app's baseline, at a 1280×900 desktop
 * and again as a Pixel 7, judged by `diffAgainstBaseline`.
 *
 * It is a spec rather than a script so the scan rides the suite's own browser
 * and `webServer`: one Playwright setup per app, not a second launcher with its
 * own server boot, readiness loop and emulation. The page list lives in ONE
 * place, the baseline's keys, so it cannot drift from what is scanned: a page
 * in the baseline but not scanned would otherwise be reported stale.
 *
 * `A11Y_UPDATE_BASELINE=1` deletes stale entries from the baseline and nothing
 * else; accepting new debt stays a hand-edit with its reason beside it.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { Browser, BrowserContextOptions, Page, Request } from '@playwright/test'
import { devices } from '@playwright/test'
import type { Baseline } from './a11yBaseline'
import { diffAgainstBaseline, serializeBaseline } from './a11yBaseline'

/** axe-core from the local install: the scan needs no network egress. */
const require = createRequire(import.meta.url)
const AXE_PATH = require.resolve('axe-core/axe.min.js')

/**
 * Every page is scanned at a desktop, then as a phone. A phone lays the apps
 * out differently — a drawer for the nav, stacked cards, narrow scroll regions
 * — so the one baseline is judged on the union of both.
 */
const EMULATIONS: Record<string, BrowserContextOptions> = {
  desktop: { viewport: { width: 1280, height: 900 } },
  'Pixel 7': (({ defaultBrowserType: _browser, ...emulation }) => emulation)(devices['Pixel 7']),
}

const SETTLE_TIMEOUT_MS = 15_000

type AxeNode = {
  html: string
  target: string[]
  failureSummary: string
}

type AxeViolation = {
  id: string
  impact: string
  description: string
  helpUrl: string
  nodes: AxeNode[]
}

type PageResult = {
  page: string
  /** `desktop`, or the Playwright device the page was emulated as. */
  device: string
  violations: number
  passes: number
  incomplete: number
  details: AxeViolation[]
}

/** The slice of the browser global the in-page functions touch; tools/ has no DOM lib. */
type InPage = {
  document: {
    readyState: string
    querySelector: (selector: string) => unknown
    querySelectorAll: (selector: string) => Iterable<{
      dataset: Record<string, string | undefined>
      getClientRects: () => { length: number }
      getBoundingClientRect: () => { top: number; bottom: number; left: number; right: number }
    }>
  }
  innerHeight: number
  innerWidth: number
  requestAnimationFrame: (callback: () => void) => number
  axe: {
    run: (
      context: unknown,
      options: { runOnly: string[] }
    ) => Promise<{ violations: AxeViolation[]; passes: unknown[]; incomplete: unknown[] }>
  }
}

/**
 * Why the page is not yet what a reader sees, or '' once it is: an island that
 * mounts without interaction (a `visible` one only when rendered on screen) has
 * not mounted, or a loading skeleton remains. Runs in the page.
 */
function unsettled(): string {
  const { document, innerHeight, innerWidth } = globalThis as unknown as InPage
  if (document.readyState !== 'complete') return 'the document is still loading'
  const waiting: string[] = []
  for (const el of document.querySelectorAll('[data-island]')) {
    if (el.dataset.client === 'visible') {
      const box = el.getBoundingClientRect()
      const onScreen =
        el.getClientRects().length > 0 &&
        box.bottom >= 0 &&
        box.top <= innerHeight &&
        box.right >= 0 &&
        box.left <= innerWidth
      if (!onScreen) continue
    }
    // React's createRoot() marks its container with a `__reactContainer$…` key.
    if (!Object.keys(el).some((key) => key.startsWith('__reactContainer$')))
      waiting.push(el.dataset.island ?? '?')
  }
  if (waiting.length > 0) return `unmounted island(s): ${waiting.join(', ')}`
  const skeleton = document.querySelector('[role="status"][aria-label="Loading"]')
  return skeleton === null ? '' : 'a loading skeleton is still showing'
}

/** Resolves after two animation frames. Runs in the page. */
function twoFrames(): Promise<void> {
  const page = globalThis as unknown as InPage
  return new Promise((resolve) => {
    page.requestAnimationFrame(() => page.requestAnimationFrame(() => resolve()))
  })
}

/** Runs axe over the document and keeps the first five nodes per violation. Runs in the page. */
async function runAxe(): Promise<Omit<PageResult, 'page' | 'device'>> {
  const { axe, document } = globalThis as unknown as InPage
  const res = await axe.run(document, {
    // `wcag22aa` adds 2.2's new AA criteria — target size (2.5.8) among
    // them, which is the one a phone layout most readily fails.
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  })
  return {
    violations: res.violations.length,
    passes: res.passes.length,
    incomplete: res.incomplete.length,
    details: res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 5).map((n) => ({
        html: n.html.substring(0, 200),
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    })),
  }
}

/**
 * Wait until `unsettled` is empty, no request is in flight, and both still hold
 * two frames later: a freshly mounted island starts its data fetch in an effect
 * after it commits, and renders the result when the fetch lands.
 */
async function waitUntilSettled(
  page: Page,
  inFlight: ReadonlySet<Request>,
  ready: string | undefined
): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS
  const settled = `(${unsettled.toString()})() === ''`
  try {
    if (ready) await page.waitForSelector(ready, { state: 'attached', timeout: SETTLE_TIMEOUT_MS })
    for (;;) {
      const timeout = deadline - Date.now()
      if (timeout <= 0) throw new Error('deadline passed')
      await page.waitForFunction(settled, null, { timeout, polling: 50 })
      while (inFlight.size > 0 && Date.now() < deadline) await page.waitForTimeout(25)
      await page.evaluate(twoFrames)
      if (inFlight.size === 0 && (await page.evaluate(unsettled)) === '') return
    }
  } catch (error) {
    const why = (await page.evaluate(unsettled).catch(() => '')) || 'nothing pending in the DOM'
    const requests = [...inFlight].map((r) => r.url()).join(', ') || 'none'
    throw new Error(
      `the page did not settle within ${SETTLE_TIMEOUT_MS} ms: ${why}; requests in flight: ${requests}`,
      { cause: error }
    )
  }
}

/** Every baseline page, scanned in one context emulating `device`. A page whose scan throws is -1. */
async function scanAs(
  browser: Browser,
  device: string,
  baseURL: string,
  pages: string[],
  ready: string | undefined
): Promise<PageResult[]> {
  const context = await browser.newContext({
    ...EMULATIONS[device],
    baseURL,
    // As in both suites' configs: a PWA worker activating mid-navigation can
    // abort the goto.
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  // Only requests that can change the DOM; an image or a font still loading cannot.
  const domInputs = new Set(['document', 'script', 'stylesheet', 'fetch', 'xhr'])
  const inFlight = new Set<Request>()
  page.on('request', (request) => {
    if (domInputs.has(request.resourceType())) inFlight.add(request)
  })
  page.on('requestfinished', (request) => inFlight.delete(request))
  page.on('requestfailed', (request) => inFlight.delete(request))

  const results: PageResult[] = []
  for (const pathname of pages) {
    // The previous page's requests say nothing about this one.
    inFlight.clear()
    try {
      await page.goto(pathname, { waitUntil: 'load', timeout: SETTLE_TIMEOUT_MS })
      await waitUntilSettled(page, inFlight, ready)
      // `addScriptTag` resolves once the script has run, so `window.axe` exists.
      await page.addScriptTag({ path: AXE_PATH })
      results.push({ page: pathname, device, ...(await page.evaluate(runAxe)) })
    } catch (err) {
      console.error(`a11y: error scanning ${pathname} (${device}): ${err}`)
      results.push({
        page: pathname,
        device,
        violations: -1,
        passes: 0,
        incomplete: 0,
        details: [],
      })
    }
  }

  await context.close()
  return results
}

/**
 * Scan every page in `tools/<baselineFile>` on every emulation and judge the
 * run against that baseline. With `A11Y_UPDATE_BASELINE=1`, stale entries are
 * deleted from the file and no longer reported.
 */
export async function scanAgainstBaseline({
  browser,
  baseURL,
  baselineFile,
  ready,
}: {
  browser: Browser
  baseURL: string
  baselineFile: string
  /** An element the page must contain before it counts as settled, for a loading state `unsettled` does not know. */
  ready?: string
}): Promise<{ results: PageResult[]; regressions: string[]; stale: string[] }> {
  const baselinePath = fileURLToPath(new URL(`../${baselineFile}`, import.meta.url))
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline
  const pages = Object.keys(baseline.pages)

  const results: PageResult[] = []
  for (const device of Object.keys(EMULATIONS)) {
    results.push(...(await scanAs(browser, device, baseURL, pages, ready)))
  }

  const { regressions, stale, pruned } = diffAgainstBaseline(results, baseline)
  if (process.env.A11Y_UPDATE_BASELINE === '1' && stale.length > 0) {
    writeFileSync(baselinePath, serializeBaseline(pruned))
    for (const line of stale) console.error(`a11y: PRUNED ${line}`)
    return { results, regressions, stale: [] }
  }
  return { results, regressions, stale }
}
