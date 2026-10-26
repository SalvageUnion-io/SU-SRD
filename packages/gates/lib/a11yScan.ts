/**
 * The WCAG 2.2 AA scan the web app runs as Playwright specs
 * (`e2e/reference-a11y.e2e.ts`, `e2e/app-a11y.e2e.ts`, the app's signed-in
 * `e2e/a11y-signed-in.e2e.ts`): axe-core
 * over the spec's page list, at a 1280×900 desktop and again as a Pixel 7. Any violation, on any
 * page or device, fails the spec.
 *
 * It is a spec rather than a script so the scan rides the suite's own browser
 * and `webServer`: one Playwright setup per app, not a second launcher with its
 * own server boot, readiness loop and emulation.
 */

import { createRequire } from 'node:module'
import type { Browser, BrowserContextOptions, Page, Request } from '@playwright/test'
import { devices } from '@playwright/test'

/** axe-core from the local install: the scan needs no network egress. */
const require = createRequire(import.meta.url)
const AXE_PATH = require.resolve('axe-core/axe.min.js')

/**
 * The rule tags every scan runs: WCAG 2.2 AA and best practice. `wcag22aa`
 * adds 2.2's new AA criteria — target size (2.5.8) among them, which is the
 * one a phone layout most readily fails.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

/**
 * axe over the page as it stands, with {@link AXE_TAGS}, injecting axe-core
 * first when the page has none: one line per violation, its id and the nodes
 * it names. For a spec that scans a live page state rather than a URL list
 * (`apps/web/e2e/_play.ts`).
 *
 * @public Imported by the Play specs through `e2e/_play.ts`, which sits
 * outside knip's project.
 */
export async function runAxeOnPage(page: Page): Promise<string[]> {
  if ((await page.evaluate(() => 'axe' in globalThis)) === false) {
    await page.addScriptTag({ path: AXE_PATH })
  }
  return await page.evaluate(async (tags) => {
    const { axe, document } = globalThis as unknown as InPage
    const result = await axe.run(document, { runOnly: tags })
    return result.violations.map(
      (v) => `${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
    )
  }, AXE_TAGS)
}

/**
 * Every page is scanned at a desktop, then as a phone. A phone lays the apps
 * out differently — a drawer for the nav, stacked cards, narrow scroll regions
 * — so each page must pass on both.
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
      getAttribute: (name: string) => string | null
      hasAttribute: (name: string) => boolean
      querySelector: (selector: string) => unknown
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
 * not mounted, or a loading skeleton or busy region remains. Runs in the page.
 */
function unsettled(): string {
  const { document, innerHeight, innerWidth } = globalThis as unknown as InPage
  if (document.readyState !== 'complete') return 'the document is still loading'
  const waiting: string[] = []
  for (const el of document.querySelectorAll('astro-island')) {
    const client = el.getAttribute('client')
    // Mounts only when a reader reaches for it: until then its server markup
    // is the page, and that is what a reader who has not touched it meets.
    if (client === 'interaction') continue
    // Never mounts on this load (the SRD's signed-in-only account menu).
    if (el.dataset.islandSkipped !== undefined) continue
    if (client === 'visible') {
      const box = el.getBoundingClientRect()
      const onScreen =
        el.getClientRects().length > 0 &&
        box.bottom >= 0 &&
        box.top <= innerHeight &&
        box.right >= 0 &&
        box.left <= innerWidth
      if (!onScreen) continue
    }
    // Astro drops `ssr` once it has hydrated an island; one swapped in over a
    // stand-in (`clientSwap`) has mounted once the stand-in is gone.
    if (el.hasAttribute('ssr') || el.querySelector(':scope > [data-standin]') !== null)
      waiting.push(el.getAttribute('component-export') ?? '?')
  }
  if (waiting.length > 0) return `unmounted island(s): ${waiting.join(', ')}`
  const skeleton = document.querySelector('[role="status"][aria-label="Loading"]')
  if (skeleton !== null) return 'a loading skeleton is still showing'
  // A router's pending screen (The app's `RoutePending`) is a `<main>` too, so it
  // satisfies a `ready: 'main'` wait while the route itself has not drawn.
  return document.querySelector('[aria-busy="true"]') === null ? '' : 'a region is still busy'
}

/** Resolves after two animation frames. Runs in the page. */
function twoFrames(): Promise<void> {
  const page = globalThis as unknown as InPage
  return new Promise((resolve) => {
    page.requestAnimationFrame(() => page.requestAnimationFrame(() => resolve()))
  })
}

/**
 * Runs axe over the document with `tags` ({@link AXE_TAGS}) and keeps the
 * first five nodes per violation. Runs in the page.
 */
async function runAxe(tags: string[]): Promise<Omit<PageResult, 'page' | 'device'>> {
  const { axe, document } = globalThis as unknown as InPage
  const res = await axe.run(document, { runOnly: tags })
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

type ScanOptions = {
  browser: Browser
  baseURL: string
  pages: readonly string[]
  /** An element the page must contain before it counts as settled, for a loading state `unsettled` does not know. */
  ready?: string
  /** Cookies and storage each context starts with: a signed-in session. */
  storageState?: BrowserContextOptions['storageState']
}

/** Every page, scanned in one context emulating `device`. A page whose scan throws is -1. */
async function scanAs(
  device: string,
  { browser, baseURL, pages, ready, storageState }: ScanOptions
): Promise<PageResult[]> {
  const context = await browser.newContext({
    ...EMULATIONS[device],
    baseURL,
    storageState,
    // As in the suite's config (apps/web/playwright.config.ts): a PWA worker
    // activating mid-navigation can abort the goto, and the production CSP
    // `bun run preview` serves would refuse the injected axe script.
    serviceWorkers: 'block',
    bypassCSP: true,
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
      results.push({ page: pathname, device, ...(await page.evaluate(runAxe, AXE_TAGS)) })
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
 * Scan every page on every emulation. Returns each result, and one line per
 * violation (or crashed scan): the spec asserts that list is empty.
 */
export async function scanPages(
  options: ScanOptions
): Promise<{ results: PageResult[]; violations: string[] }> {
  const results: PageResult[] = []
  for (const device of Object.keys(EMULATIONS)) results.push(...(await scanAs(device, options)))

  const violations: string[] = []
  for (const result of results) {
    // A crashed scan is -1. It must never read as "no violations".
    if (result.violations < 0) {
      violations.push(`${result.page} (${result.device}): the scan itself failed`)
      continue
    }
    for (const { id } of result.details) violations.push(`${result.page} (${result.device}): ${id}`)
  }
  return { results, violations }
}
