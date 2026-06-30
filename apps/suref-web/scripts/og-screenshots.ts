/**
 * Build-time OG-image generator.
 *
 * Renders the REAL ReferenceEntityDisplay card for every entity (1:1 with the
 * on-page view) and screenshots it to `dist/schema/{schemaId}/item/{itemId}.og.png`
 * — the path each item page references as its og:image.
 *
 * Pipeline:
 *   1. Enumerate entities via getItemStaticPaths (same source as the routes, so
 *      every og.png path matches a real item page).
 *   2. Serve the freshly-built `dist/` with `astro preview`.
 *   3. Drive headless chromium (Playwright) across `/og-card/?schema=&item=` for
 *      each entity, capturing the fixed 1200×630 canvas.
 *
 * Runs after `astro build` (see package.json `build`). Requires a chromium
 * binary: Playwright resolves its own after `bunx playwright install chromium`
 * (the Netlify build installs it; locally it is shared with the ITUN e2e cache).
 * Set OG_CHROME_PATH to use a specific executable, or OG_SCREENSHOTS_SKIP=1 to
 * skip.
 *
 * The run writes a machine-readable outcome to `dist/_og-status.json` and, while
 * we confirm chromium runs in the Netlify build container, does NOT fail the
 * build on render errors — so the deploy publishes and the status file is
 * inspectable from the deploy URL. (To be tightened to fail-on-error once the
 * Netlify path is confirmed.)
 */
/* eslint-disable no-console -- build-time CLI: stdout progress is intended output */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getItemStaticPaths } from '../src/lib/staticPaths'

const OG_WIDTH = 1200
const OG_HEIGHT = 630
const PORT = Number(process.env.OG_SCREENSHOTS_PORT ?? 4399)
const CONCURRENCY = Number(process.env.OG_SCREENSHOTS_CONCURRENCY ?? 6)
const CARD_SELECTOR = '[data-testid="frame-header-container"]'
const NAV_TIMEOUT = 30_000

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(APP_ROOT, 'dist')
const STATUS_PATH = join(DIST_DIR, '_og-status.json')

type Entity = { schemaId: string; itemId: string }
type Status = {
  ok: boolean
  total: number
  generated: number
  failed: number
  browserError?: string
  sampleFailures: string[]
  finishedAt: string
}

function log(msg: string) {
  console.log(`[og-screenshots] ${msg}`)
}

function writeStatus(status: Status) {
  try {
    mkdirSync(DIST_DIR, { recursive: true })
    writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2))
  } catch {
    // best-effort diagnostic; never let status writing mask the real result
  }
}

/** Wait until the preview server answers, or throw after `timeoutMs`. */
async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok || res.status === 404) return
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`preview server did not start at ${url}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}

async function main() {
  if (process.env.OG_SCREENSHOTS_SKIP) {
    log('OG_SCREENSHOTS_SKIP set — skipping og:image generation.')
    return
  }

  const entities: Entity[] = getItemStaticPaths().map((p) => ({
    schemaId: p.params.schemaId,
    itemId: p.params.itemId,
  }))
  if (entities.length === 0) {
    log('no entities found — nothing to render.')
    return
  }
  log(`generating ${entities.length} og:images (${CONCURRENCY} concurrent)…`)

  let chromium: typeof import('playwright').chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch (err) {
    const browserError = `Playwright not importable: ${err instanceof Error ? err.message : String(err)}`
    log(browserError)
    writeStatus({
      ok: false,
      total: entities.length,
      generated: 0,
      failed: entities.length,
      browserError,
      sampleFailures: [],
      finishedAt: new Date().toISOString(),
    })
    return
  }

  // Serve the built site. `astro preview` honours trailingSlash + content types.
  // Pin --host 127.0.0.1 so it binds IPv4 (its default `localhost` resolves to
  // ::1 on some machines, which wouldn't match the 127.0.0.1 base below).
  const preview = Bun.spawn(
    ['bunx', 'astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
    {
      cwd: APP_ROOT,
      stdout: 'ignore',
      stderr: 'inherit',
      env: process.env,
    }
  )

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  const base = `http://127.0.0.1:${PORT}`
  const failures: { entity: Entity; error: string }[] = []
  let generated = 0

  try {
    await waitForServer(`${base}/og-card/`)

    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.OG_CHROME_PATH || undefined,
      })
    } catch (err) {
      const browserError = `chromium.launch failed: ${err instanceof Error ? err.message : String(err)}`
      log(browserError)
      writeStatus({
        ok: false,
        total: entities.length,
        generated: 0,
        failed: entities.length,
        browserError,
        sampleFailures: [],
        finishedAt: new Date().toISOString(),
      })
      return
    }

    const context = await browser.newContext({
      viewport: { width: OG_WIDTH, height: OG_HEIGHT },
      deviceScaleFactor: 1,
    })

    const captureOne = async (page: import('playwright').Page, entity: Entity): Promise<void> => {
      const url = `${base}/og-card/?schema=${encodeURIComponent(entity.schemaId)}&item=${encodeURIComponent(entity.itemId)}`
      await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT })
      await page.waitForSelector(CARD_SELECTOR, { timeout: NAV_TIMEOUT })
      await page.evaluate(() => document.fonts.ready)
      const outPath = join(DIST_DIR, 'schema', entity.schemaId, 'item', `${entity.itemId}.og.png`)
      mkdirSync(dirname(outPath), { recursive: true })
      await page.screenshot({ path: outPath, type: 'png' })
    }

    // Worker pool: each worker owns one page and pulls from a shared cursor.
    let cursor = 0
    let done = 0
    const worker = async () => {
      let page = await context.newPage()
      try {
        for (;;) {
          const index = cursor++
          if (index >= entities.length) break
          const entity = entities[index]!
          try {
            await captureOne(page, entity)
            generated++
          } catch (firstErr) {
            // Retry on a FRESH page so a wedged renderer (hung hydration, lost
            // context) can't cascade into this worker's remaining entities.
            try {
              await page.close().catch(() => {})
              page = await context.newPage()
              await captureOne(page, entity)
              generated++
            } catch (retryErr) {
              failures.push({
                entity,
                error: `${firstErr instanceof Error ? firstErr.message : String(firstErr)} | retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
              })
            }
          }
          done++
          if (done % 200 === 0 || done === entities.length) {
            log(`${done}/${entities.length}`)
          }
        }
      } finally {
        await page.close().catch(() => {})
      }
    }

    await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker))
    await context.close()
  } finally {
    await browser?.close()
    preview.kill()
    await preview.exited
  }

  for (const f of failures.slice(0, 20)) {
    log(`FAILED ${f.entity.schemaId}/${f.entity.itemId}: ${f.error}`)
  }
  writeStatus({
    ok: failures.length === 0,
    total: entities.length,
    generated,
    failed: failures.length,
    sampleFailures: failures
      .slice(0, 10)
      .map((f) => `${f.entity.schemaId}/${f.entity.itemId}: ${f.error}`),
    finishedAt: new Date().toISOString(),
  })
  log(`done — ${generated}/${entities.length} og:images written, ${failures.length} failed.`)
}

main().catch((err) => {
  console.error('[og-screenshots]', err)
  // Diagnostic phase: don't fail the build on unexpected errors — record them.
  writeStatus({
    ok: false,
    total: 0,
    generated: 0,
    failed: 0,
    browserError: `unexpected: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    sampleFailures: [],
    finishedAt: new Date().toISOString(),
  })
})
