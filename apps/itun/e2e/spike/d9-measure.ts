import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { buildMech, buildPilot, openSheetFor, waitForReady } from '../_helpers'
import { seamIsPresent, signInFresh } from '../fixtures'

/**
 * D9 spike: cold load and offline behaviour with the device cache (flag off)
 * and without it (`itun:convex-direct`, flag on). Prints one JSON line per
 * measurement; docs/spikes/d9-offline-cache.md records the results.
 */

const RUNS = 5
const PILOT = 'D9 Runner'

type Load = {
  ms: number
  requests: number
  fromServiceWorker: number
  fromDiskCache: number
  networkBytes: number
  /** 1 when "not found" rendered before the pilot did. */
  notFoundFlash: number
}

/** Navigate to `url` and time it until the pilot's name is on the sheet. */
async function measureLoad(page: Page, url: string): Promise<Load> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  const sw = new Set<string>()
  const disk = new Set<string>()
  let requests = 0
  let networkBytes = 0
  cdp.on('Network.requestWillBeSent', () => {
    requests++
  })
  cdp.on('Network.responseReceived', (e) => {
    if (e.response.fromServiceWorker) sw.add(e.requestId)
    if (e.response.fromDiskCache) disk.add(e.requestId)
  })
  cdp.on('Network.loadingFinished', (e) => {
    if (!sw.has(e.requestId) && !disk.has(e.requestId)) networkBytes += e.encodedDataLength
  })
  const start = Date.now()
  await page.goto(url)
  await expect(page.getByText(PILOT).first()).toBeVisible({ timeout: 60_000 })
  const ms = Date.now() - start
  const notFoundFlash = (await page.evaluate(
    () => (window as unknown as { __d9NotFound?: boolean }).__d9NotFound === true
  ))
    ? 1
    : 0
  // Let trailing requests (the socket's first frames, lazy chunks) settle.
  await page.waitForTimeout(1500)
  await cdp.detach()
  return {
    ms,
    requests,
    fromServiceWorker: sw.size,
    fromDiskCache: disk.size,
    networkBytes,
    notFoundFlash,
  }
}

/** One JSON line per measurement: the doc's tables are read off these. */
function report(line: Record<string, unknown>): void {
  // biome-ignore lint/suspicious/noConsole: the measurement's output is the point of this script.
  console.log(`D9 ${JSON.stringify(line)}`)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN
}

function summarise(label: string, loads: Load[]): void {
  const keys = [
    'ms',
    'requests',
    'fromServiceWorker',
    'fromDiskCache',
    'networkBytes',
    'notFoundFlash',
  ] as const
  const out: Record<string, unknown> = { label, runs: loads.length }
  for (const k of keys) out[k] = median(loads.map((l) => l[k]))
  out.raw = loads.map((l) => l.ms)
  out.flashes = loads.filter((l) => l.notFoundFlash === 1).length
  report(out)
}

async function contextFor(
  browser: import('@playwright/test').Browser,
  state: Awaited<ReturnType<BrowserContext['storageState']>>,
  flag: boolean
): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: state, serviceWorkers: 'allow' })
  await context.addInitScript((on) => {
    if (on) localStorage.setItem('itun:convex-direct', '1')
    else localStorage.removeItem('itun:convex-direct')
    // Record whether the sheet ever says "not found" while it loads.
    new MutationObserver((_, observer) => {
      if (/not found/i.test(document.body?.innerText ?? '')) {
        ;(window as unknown as { __d9NotFound?: boolean }).__d9NotFound = true
        observer.disconnect()
      }
    }).observe(document, { childList: true, subtree: true, characterData: true })
  }, flag)
  return context
}

/** What an offline page shows: the pilot, an empty app, or no app at all. */
async function offlineView(page: Page): Promise<string> {
  const pilot = await page
    .getByText(PILOT)
    .first()
    .isVisible({ timeout: 10_000 })
    .catch(() => false)
  if (pilot) return 'pilot visible'
  const app = await page.locator('#root *').count()
  const text = (
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  ).slice(0, 160)
  return app > 0
    ? `app shell, no pilot: ${JSON.stringify(text)}`
    : `no app: ${JSON.stringify(text)}`
}

test('D9: cold load and offline, flag off vs on', async ({ browser }) => {
  // One account with a pilot and a mech, shared by every measurement.
  const setup = await browser.newContext({ serviceWorkers: 'block' })
  const page = await setup.newPage()
  await page.goto('/')
  await waitForReady(page)
  expect(await seamIsPresent(page), 'build needs VITE_TEST_AUTH').toBe(true)
  await signInFresh(page)
  await buildPilot(page, PILOT, 'Runner')
  await buildMech(page, 'D9 Hauler')
  await openSheetFor(page, PILOT)
  const sheetUrl = new URL(page.url()).pathname
  // Convex Auth rotates its refresh token on use, so a replayed snapshot signs
  // the next context out. Each context hands its own state to the next.
  let state = await setup.storageState()
  await setup.close()

  for (const flag of [false, true]) {
    const label = flag ? 'flag on (no cache, no SW)' : 'flag off (IndexedDB + SW)'

    // First visit: an empty browser profile (no IndexedDB, no worker, no HTTP cache).
    const first: Load[] = []
    for (let i = 0; i < RUNS; i++) {
      const ctx = await contextFor(browser, state, flag)
      first.push(await measureLoad(await ctx.newPage(), sheetUrl))
      state = await ctx.storageState()
      await ctx.close()
    }
    summarise(`${label} — first visit`, first)

    // Repeat visits: one profile, warmed by a first visit and its worker install.
    const ctx = await contextFor(browser, state, flag)
    const warm = await ctx.newPage()
    await measureLoad(warm, sheetUrl)
    if (!flag) {
      await warm.evaluate(async () => {
        await navigator.serviceWorker.ready
      })
    }
    await warm.close()
    const repeat: Load[] = []
    for (let i = 0; i < RUNS; i++) {
      const p = await ctx.newPage()
      repeat.push(await measureLoad(p, sheetUrl))
      await p.close()
    }
    summarise(`${label} — repeat visit`, repeat)

    // Offline, mid-session: the sheet is open, then the network goes.
    const live = await ctx.newPage()
    await measureLoad(live, sheetUrl)
    await ctx.setOffline(true)
    await live.waitForTimeout(3000)
    const banner = (await live.locator('body').innerText()).match(/offline|disconnected|read-only/i)
    report({
      label,
      offline: 'mid-session',
      view: await offlineView(live),
      banner: banner?.[0] ?? null,
    })

    // Offline, reload: the network is gone and the player reopens the sheet.
    const reopened = await live.reload({ timeout: 15_000 }).then(
      () => 'loaded',
      (e: unknown) => `reload failed: ${String(e).split('\n')[0]}`
    )
    if (reopened === 'loaded') await live.waitForTimeout(5000)
    // Whether the session survived the offline boot: Convex Auth's stored keys.
    const authKeys =
      reopened === 'loaded'
        ? await live.evaluate(() => Object.keys(localStorage).filter((k) => /auth/i.test(k)))
        : []
    report({ label, offline: 'reload', reopened, authKeys, view: await offlineView(live) })
    if (reopened === 'loaded') {
      await live.waitForTimeout(30_000)
      report({ label, offline: 'reload +30s', view: await offlineView(live) })
    }
    await live.screenshot({ path: `test-results/d9-offline-reload-${flag ? 'on' : 'off'}.png` })
    await ctx.setOffline(false)
    const back = await ctx.newPage()
    await measureLoad(back, sheetUrl)
    state = await ctx.storageState()
    await ctx.close()
  }
})
