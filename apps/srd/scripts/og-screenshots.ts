/**
 * Build-time OG-image generator.
 *
 * Renders the REAL ReferenceEntityCard card for every entity (1:1 with the
 * on-page view) and screenshots it to `dist/schema/{schemaId}/item/{itemId}.og.png`
 * — the path each item page references as its og:image.
 *
 * Pipeline:
 *   1. Enumerate entities via getItemStaticPaths (same source as the routes, so
 *      every og.png path matches a real item page).
 *   2. Serve the freshly-built `dist/` with `astro preview`.
 *   3. Drive headless chromium (Playwright). Each worker loads `/og-card/` ONCE
 *      (game-data corpus + island loaded a single time) and re-renders each
 *      entity in place via `window.__ogSetEntity` — far faster and lighter than
 *      a navigation per entity, and it avoids the under-load dynamic-import
 *      failures that per-navigation rendering hit on the Netlify builder.
 *
 * Runs after `astro build` (see package.json `build`). Requires a chromium
 * binary: provision it via the `og:install-browser` package script (resolves
 * srd's pinned playwright so the build matches its playwright-core). Set
 * OG_CHROME_PATH to use a specific executable, or OG_SCREENSHOTS_SKIP=1 to skip
 * (the GH compile-check job sets it; the Netlify deploy generates for real).
 *
 * Fails the build if chromium can't be provisioned or any entity fails to
 * render, so a deploy never ships a page whose og:image 404s.
 */
/* eslint-disable no-console -- build-time CLI: stdout progress is intended output */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getItemStaticPaths } from '../src/lib/staticPaths'

const OG_WIDTH = 1200
const OG_HEIGHT = 630
const PORT = Number(process.env.OG_SCREENSHOTS_PORT ?? 4399)
const CONCURRENCY = Number(process.env.OG_SCREENSHOTS_CONCURRENCY ?? 5)
// Reload each worker's page every N captures to release accumulated memory.
const RELOAD_EVERY = Number(process.env.OG_SCREENSHOTS_RELOAD_EVERY ?? 200)
const CARD_SELECTOR = '[data-testid="frame-header-container"]'
const NAV_TIMEOUT = 30_000
// Container-hardening flags: no GPU process (it gets OOM-killed, exit_code=9,
// and takes the browser down) and a small shared-memory footprint.
const LAUNCH_ARGS = [
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
]

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(APP_ROOT, 'dist')

// ---------------------------------------------------------------------------
// Incremental cache (audit item 29).
//
// `astro build` wipes dist/, so "skip unchanged" needs the PNGs to survive
// OUTSIDE dist: a cache dir under node_modules/.cache keyed by a manifest of
// content hashes. Hash input = the entity's JSON + SCRIPT_VERSION — bump
// SCRIPT_VERSION whenever the card RENDERING changes (og-card page, the
// ReferenceEntityCard stack in component-lib, fonts, dimensions), since the
// entity data alone can't see those.
//
// Unchanged entity + cached PNG → copy into dist, no screenshot. The cache is
// best-effort: locally and in CI it persists across builds via node_modules;
// on a cold Netlify builder (or after `OG_SCREENSHOTS_NO_CACHE=1`) everything
// re-renders exactly as before.
// ---------------------------------------------------------------------------
const SCRIPT_VERSION = 1
const CACHE_DIR = join(APP_ROOT, 'node_modules', '.cache', 'srd-og')
const MANIFEST_PATH = join(CACHE_DIR, 'manifest.json')

type Manifest = Record<string, string> // "schemaId/itemId" -> content hash

function readManifest(): Manifest {
  if (process.env.OG_SCREENSHOTS_NO_CACHE) return {}
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
  } catch {
    return {}
  }
}

function entityHash(item: unknown): string {
  return createHash('sha1')
    .update(`v${SCRIPT_VERSION}:${OG_WIDTH}x${OG_HEIGHT}:`)
    .update(JSON.stringify(item))
    .digest('hex')
}

function cachePngPath(entity: Entity): string {
  return join(CACHE_DIR, entity.schemaId, `${entity.itemId}.og.png`)
}

function distPngPath(entity: Entity): string {
  return join(DIST_DIR, 'schema', entity.schemaId, 'item', `${entity.itemId}.og.png`)
}

type Entity = { schemaId: string; itemId: string; hash: string }

function log(msg: string) {
  // biome-ignore lint/suspicious/noConsole: build-time CLI script — progress logging to stdout is the point
  console.log(`[og-screenshots] ${msg}`)
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

  const allEntities: Entity[] = getItemStaticPaths().map((p) => ({
    schemaId: p.params.schemaId,
    itemId: p.params.itemId,
    hash: entityHash(p.props.item),
  }))
  if (allEntities.length === 0) {
    log('no entities found — nothing to render.')
    return
  }

  // Partition: unchanged entities with a cached PNG restore straight into
  // dist; only the rest get screenshotted.
  const previous = readManifest()
  const entities: Entity[] = []
  let restored = 0
  for (const entity of allEntities) {
    const key = `${entity.schemaId}/${entity.itemId}`
    const cached = cachePngPath(entity)
    if (previous[key] === entity.hash && existsSync(cached)) {
      mkdirSync(dirname(distPngPath(entity)), { recursive: true })
      copyFileSync(cached, distPngPath(entity))
      restored++
    } else {
      entities.push(entity)
    }
  }

  // Manifest for THIS build: every current entity, hashed. Stale keys drop out.
  const nextManifest: Manifest = Object.fromEntries(
    allEntities.map((e) => [`${e.schemaId}/${e.itemId}`, e.hash])
  )
  const writeManifest = () => {
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest))
  }

  if (restored > 0) log(`${restored}/${allEntities.length} unchanged — restored from cache.`)
  if (entities.length === 0) {
    writeManifest()
    log('all og:images restored from cache — nothing to render.')
    return
  }
  log(`generating ${entities.length} og:images (${CONCURRENCY} concurrent)…`)

  let chromium: typeof import('playwright').chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch (err) {
    throw new Error('Playwright not importable — run `bun --filter srd og:install-browser`.', {
      cause: err,
    })
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

  type Context = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>>
  type Page = import('playwright').Page

  const base = `http://127.0.0.1:${PORT}`
  const failures: { entity: Entity; error: string }[] = []
  let generated = 0
  let done = 0

  // Load /og-card/ once and wait until game data is ready; the page then renders
  // any entity in place via window.__ogSetEntity (exposed when data-og-ready
  // appears).
  const freshPage = async (context: Context): Promise<Page> => {
    const page = await context.newPage()
    await page.goto(`${base}/og-card/`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-og-ready'), null, {
      timeout: NAV_TIMEOUT,
    })
    return page
  }

  // Swap the in-page entity and capture it — no navigation, so the island + data
  // corpus stay loaded across the whole run.
  const captureInPage = async (page: Page, entity: Entity): Promise<void> => {
    const key = `${entity.schemaId}/${entity.itemId}`
    await page.evaluate(([schema, item]) => window.__ogSetEntity?.(schema, item), [
      entity.schemaId,
      entity.itemId,
    ] as [string, string])
    // Wait until that exact entity is the one committed to the DOM.
    await page.waitForFunction(
      (k) => document.documentElement.getAttribute('data-og-current') === k,
      key,
      { timeout: NAV_TIMEOUT }
    )
    await page.waitForSelector(CARD_SELECTOR, { timeout: NAV_TIMEOUT })
    await page.evaluate(() => document.fonts.ready)
    // One paint frame so the swapped card is fully rendered before capture.
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    )
    const outPath = distPngPath(entity)
    mkdirSync(dirname(outPath), { recursive: true })
    await page.screenshot({ path: outPath, type: 'png' })
    // Mirror into the incremental cache so the next build can skip this one.
    const cached = cachePngPath(entity)
    mkdirSync(dirname(cached), { recursive: true })
    copyFileSync(outPath, cached)
  }

  try {
    await waitForServer(`${base}/og-card/`)

    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.OG_CHROME_PATH || undefined,
      args: LAUNCH_ARGS,
    })

    try {
      const context = await browser.newContext({
        viewport: { width: OG_WIDTH, height: OG_HEIGHT },
        deviceScaleFactor: 1,
      })

      let cursor = 0
      const worker = async () => {
        let page = await freshPage(context)
        let sinceReload = 0
        try {
          for (;;) {
            const index = cursor++
            const entity = entities[index]
            // Dense array: undefined here means the queue is exhausted.
            if (!entity) break
            try {
              await captureInPage(page, entity)
              generated++
            } catch (firstErr) {
              // Recover on a fresh page (reloads the island + data) so a wedged
              // renderer can't cascade into this worker's remaining entities.
              try {
                await page.close().catch(() => {})
                page = await freshPage(context)
                sinceReload = 0
                await captureInPage(page, entity)
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
            if (++sinceReload >= RELOAD_EVERY) {
              await page.close().catch(() => {})
              page = await freshPage(context)
              sinceReload = 0
            }
          }
        } finally {
          await page.close().catch(() => {})
        }
      }

      await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker))
      await context.close().catch(() => {})
    } finally {
      await browser.close().catch(() => {})
    }
  } finally {
    preview.kill()
    await preview.exited
  }

  // Persist the manifest minus any failures — a failed entity must not be
  // "restored" from a stale cached PNG on the next run.
  for (const f of failures) {
    delete nextManifest[`${f.entity.schemaId}/${f.entity.itemId}`]
  }
  writeManifest()

  if (failures.length > 0) {
    for (const f of failures.slice(0, 20)) {
      log(`FAILED ${f.entity.schemaId}/${f.entity.itemId}: ${f.error}`)
    }
    throw new Error(`${failures.length}/${entities.length} og:image(s) failed to render.`)
  }
  log(`done — ${generated} rendered, ${restored} restored from cache.`)
}

main().catch((err) => {
  console.error('[og-screenshots]', err)
  process.exit(1)
})
