/**
 * Accessibility audit script using axe-core + Playwright.
 * Scans pages of a running dev server and reports WCAG 2.1 AA violations.
 *
 * Usage:
 *   bun tools/a11y-scan.ts <base-url> <page1> <page2> ...
 *   bun tools/a11y-scan.ts --baseline tools/a11y-baseline.json <base-url>
 *
 * With `--baseline` and no pages, the pages scanned are exactly the baseline's
 * keys. That is how both callers run it — the PR-blocking step in CI's
 * `build-srd` job and the nightly — so the page list lives in ONE place (the
 * baseline) rather than being restated in each workflow, and cannot drift from
 * it: a page in the baseline but not scanned would otherwise be reported stale.
 *
 * Uses Playwright rather than puppeteer-core so the repo has ONE browser
 * automation stack. puppeteer-core ships no browser, so this script previously
 * had to borrow the Chromium that Playwright installs for the e2e suites — the
 * nightly workflow ran a dedicated step that booted Node just to print
 * `chromium.executablePath()` into the environment. Playwright resolves its own
 * browser, so that step is gone and there is no second stack to keep in sync.
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Page, Request } from 'playwright'
import { chromium } from 'playwright'

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js'

// Inject axe-core from the local install when available so the scan needs no
// network egress — the Claude Code sandbox does not allow-list the CDN host.
// Falls back to AXE_CDN for standalone use outside the repo. Requires axe-core
// to be a (dev)dependency for the local path to resolve.
const require = createRequire(import.meta.url)
let AXE_LOCAL_PATH: string | null = null
try {
  AXE_LOCAL_PATH = require.resolve('axe-core/axe.min.js')
} catch {
  AXE_LOCAL_PATH = null
}

// Chrome under the Claude Code sandbox: relocate Chrome's temp dir out of the
// macOS per-user temp (confstr _CS_DARWIN_USER_TEMP_DIR -> /var/folders/.../T),
// which the sandbox denies writes to. Chrome's ProcessSingleton creates its
// control socket there and aborts launch when it can't ("Failed to create
// socket directory" / "Failed to bind()"). macOS Chrome reads MAC_CHROMIUM_TMPDIR
// for this (it ignores $TMPDIR). The chosen dir must ALSO be listed in
// sandbox.network.allowUnixSockets so the singleton socket can bind — see
// .claude/settings.json. Harmless off macOS / outside the sandbox.
const CHROME_TMP = join(homedir(), '.cache', 'chrome-a11y')
mkdirSync(CHROME_TMP, { recursive: true })
process.env.MAC_CHROMIUM_TMPDIR = CHROME_TMP

// Chrome binary. Playwright resolves its own bundled Chromium, which is what CI
// uses (`playwright install chromium`, already cached for the e2e suites), so
// this is normally unset. CHROME_PATH still overrides it for a local run that
// wants a specific binary — e.g. the system Google Chrome.
const CHROME_EXECUTABLE = process.env.CHROME_PATH || undefined

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
  violations: number
  passes: number
  incomplete: number
  details: AxeViolation[]
}

const SETTLE_TIMEOUT_MS = 15_000

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

/**
 * Wait until `unsettled` is empty, no request is in flight, and both still hold
 * two frames later: a freshly mounted island starts its data fetch in an effect
 * after it commits, and renders the result when the fetch lands.
 */
async function waitUntilSettled(page: Page, inFlight: ReadonlySet<Request>): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS
  const settled = `(${unsettled.toString()})() === ''`
  try {
    for (;;) {
      const timeout = deadline - Date.now()
      if (timeout <= 0) throw new Error('deadline passed')
      await page.waitForFunction(settled, null, { timeout, polling: 50 })
      while (inFlight.size > 0 && Date.now() < deadline) await Bun.sleep(25)
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

async function scanPage(
  page: Page,
  inFlight: Set<Request>,
  url: string,
  pathname: string
): Promise<PageResult> {
  // The previous page's requests say nothing about this one.
  inFlight.clear()
  await page.goto(url, { waitUntil: 'load', timeout: SETTLE_TIMEOUT_MS })
  await waitUntilSettled(page, inFlight)

  // Inject axe-core — local copy when resolvable (no network), else CDN.
  // `addScriptTag` resolves once the script has run, so `window.axe` exists.
  if (AXE_LOCAL_PATH) {
    await page.addScriptTag({ path: AXE_LOCAL_PATH })
  } else {
    await page.addScriptTag({ url: AXE_CDN })
  }

  const results = await page.evaluate(async () => {
    // @ts-expect-error axe is injected via script tag
    const res = await window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    })
    return {
      violations: res.violations.length,
      passes: res.passes.length,
      incomplete: res.incomplete.length,
      details: res.violations.map(
        (v: {
          id: string
          impact: string
          description: string
          helpUrl: string
          nodes: { html: string; target: string[]; failureSummary: string }[]
        }) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodes: v.nodes.slice(0, 5).map((n) => ({
            html: n.html.substring(0, 200),
            target: n.target,
            failureSummary: n.failureSummary,
          })),
        })
      ),
    }
  })

  return { page: pathname, ...results }
}

/**
 * The accepted-violation baseline: page path -> the axe rule ids tolerated there.
 *
 * A rule id in this file is DEBT, deliberately accepted with a reason recorded
 * beside it. A rule id NOT in this file is a regression, and the run exits
 * non-zero on it.
 *
 * The point of the shape is that it only ever gets easier to satisfy: adding a
 * page or a rule requires editing this file, which is a reviewable act, while
 * fixing something and deleting its entry needs no ceremony at all.
 */
type Baseline = {
  /** Free-text, per key, explaining why each id is tolerated. Not read by code. */
  $rationale?: Record<string, string>
  pages: Record<string, string[]>
}

/**
 * Compare a run against the baseline.
 *
 * Reports two things, and the second is the one that keeps the file honest:
 * NEW ids (a regression) and STALE entries (an id that no longer fires, or a
 * page that is no longer scanned). A baseline nobody prunes drifts into a
 * blanket exemption, so a stale entry is a failure too.
 */
function diffAgainstBaseline(
  results: PageResult[],
  baseline: Baseline
): { regressions: string[]; stale: string[] } {
  const regressions: string[] = []
  const stale: string[] = []
  const scanned = new Set(results.map((r) => r.page))

  for (const result of results) {
    // A crashed scan is -1. It must never read as "no violations".
    if (result.violations < 0) {
      regressions.push(`${result.page}: the scan itself failed`)
      continue
    }
    const accepted = new Set(baseline.pages[result.page] ?? [])
    const seen = new Set(result.details.map((v) => v.id))
    for (const id of seen) {
      if (!accepted.has(id)) regressions.push(`${result.page}: ${id}`)
    }
    for (const id of accepted) {
      if (!seen.has(id)) stale.push(`${result.page}: ${id} no longer fires — remove it`)
    }
  }

  for (const page of Object.keys(baseline.pages)) {
    if (!scanned.has(page)) stale.push(`${page} is in the baseline but was not scanned`)
  }

  return { regressions, stale }
}

async function main() {
  const argv = process.argv.slice(2)
  const baselineFlag = argv.indexOf('--baseline')
  const baselinePath = baselineFlag === -1 ? null : argv[baselineFlag + 1]
  const positional =
    baselineFlag === -1 ? argv : [...argv.slice(0, baselineFlag), ...argv.slice(baselineFlag + 2)]

  const [baseUrl, ...listed] = positional
  const baseline = baselinePath
    ? (JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline)
    : null
  const pages = listed.length > 0 ? listed : Object.keys(baseline?.pages ?? {})
  if (!baseUrl || pages.length === 0) {
    console.error(
      'Usage: bun tools/a11y-scan.ts [--baseline <file>] <base-url> <page1> <page2> ...'
    )
    process.exit(1)
  }

  // `launchPersistentContext` rather than `launch` so the profile directory
  // stays explicit: the sandbox workaround above depends on Chrome writing its
  // profile and singleton socket under CHROME_TMP, and plain `launch()` would
  // pick a temp dir the sandbox denies.
  const context = await chromium.launchPersistentContext(join(CHROME_TMP, 'profile'), {
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--disk-cache-dir=${join(CHROME_TMP, 'cache')}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Crashpad/breakpad write to ~/Library/Application Support/Google and
      // register a Mach service, both sandbox-denied (non-fatal but noisy).
      '--disable-crash-reporter',
      '--disable-breakpad',
      // Avoid the macOS login keychain (sandbox-gated) for Chrome Safe Storage.
      '--use-mock-keychain',
      '--password-store=basic',
    ],
  })

  // A persistent context opens with one page already; reuse it rather than
  // leaving a blank tab open (viewport is set on the context above).
  const page = context.pages()[0] ?? (await context.newPage())
  // Only requests that can change the DOM; an image or a font still loading cannot.
  const domInputs = new Set(['document', 'script', 'stylesheet', 'fetch', 'xhr'])
  const inFlight = new Set<Request>()
  page.on('request', (request) => {
    if (domInputs.has(request.resourceType())) inFlight.add(request)
  })
  page.on('requestfinished', (request) => inFlight.delete(request))
  page.on('requestfailed', (request) => inFlight.delete(request))

  const allResults: PageResult[] = []

  for (const pathname of pages) {
    const url = `${baseUrl}${pathname}`
    console.error(`Scanning ${url}...`)
    try {
      const result = await scanPage(page, inFlight, url, pathname)
      allResults.push(result)
    } catch (err) {
      console.error(`  Error scanning ${pathname}: ${err}`)
      allResults.push({
        page: pathname,
        violations: -1,
        passes: 0,
        incomplete: 0,
        details: [],
      })
    }
  }

  await context.close()

  // Output JSON results
  console.log(JSON.stringify(allResults, null, 2))

  if (!baseline) return

  const { regressions, stale } = diffAgainstBaseline(allResults, baseline)

  for (const line of regressions) console.error(`NEW VIOLATION  ${line}`)
  for (const line of stale) console.error(`STALE BASELINE ${line}`)

  if (regressions.length > 0 || stale.length > 0) {
    console.error(
      `\n${regressions.length} new violation(s), ${stale.length} stale baseline entr(y/ies).`
    )
    console.error(
      'A new id is a regression. A stale entry means something was fixed — delete the line.'
    )
    process.exit(1)
  }
  console.error('a11y: no new violations, and no stale baseline entries.')
}

main()
