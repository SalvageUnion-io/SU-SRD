/**
 * Build-time OG-image generator.
 *
 * Renders every entity's link preview — `OgCard` (issue 1280), built from the
 * same ChapterBand, stat boxes and Union bar as the pages — at its own
 * 1200×630 and writes it to `dist/schema/{schemaId}/item/{itemId}.og.png`, the
 * path each page references as its og:image. It replaced the screenshot of the
 * Catalog tile, keeping that pipeline's reason: the preview is drawn by the
 * page's own parts, so it cannot drift from them.
 *
 * Chassis PATTERNS are covered as entities in their own right: a pattern has its
 * own page, its own card view (the card takes the chassis as `data` plus the
 * `pattern` it renders as the subject) and its own provenance, so it gets its
 * own card at `…/item/{itemId}/pattern/{patternId}.og.png` rather than
 * inheriting the chassis image.
 *
 * Pipeline:
 *   1. Enumerate targets via getItemStaticPaths + getPatternStaticPaths (the
 *      same sources as the routes, so every og.png path matches a real page).
 *   2. Serve the freshly-built `dist/` with `bun run preview` (`wrangler dev`
 *      over `wrangler.jsonc`) — the server the e2e suite runs against, and the
 *      URL->file mapping production's Static Assets applies.
 *   3. Drive headless chromium (Playwright). Each worker loads `/og-card/` ONCE
 *      (game-data corpus + island loaded a single time) and re-renders each
 *      entity in place via `window.__ogSetEntity` — far faster and lighter than
 *      a navigation per entity, and it avoids the under-load dynamic-import
 *      failures that per-navigation rendering hits.
 *   4. Screenshot the `#og-card` frame — exactly the card, 1200×630 at a
 *      device scale of 1, so nothing is fitted or resampled — and palette-
 *      compress it with sharp.
 *
 * WHY THIS IS OPT-IN (read before re-enabling it in a deploy):
 * run unbounded on every build, a cold cache re-renders ~1.5k entity cards and
 * blows the build's time limit — every srd deploy fails (#482). So it is:
 *   - OFF unless OG_SCREENSHOTS=1 (so no build can regress into that failure),
 *   - bounded by OG_SCREENSHOTS_BUDGET_MS, after which it stops rendering and
 *     leaves the remaining entities on the site-wide default og:image, and
 *   - never fatal: a failure logs and exits 0 rather than failing the build.
 * Generate locally (`bun --filter srd og:generate`) and let the cache carry it.
 *
 * Set OG_CHROME_PATH to use a specific chromium executable.
 */
/* eslint-disable no-console -- build-time CLI: stdout progress is intended output */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { DEFAULT_OG_IMAGE, SITE_URL } from '../src/lib/constants'
import { OG_HEIGHT, OG_WIDTH, ogImagePath } from '../src/lib/ogCard'
import { getItemStaticPaths, getPatternStaticPaths } from '../src/lib/staticPaths'

const PORT = Number(process.env.OG_SCREENSHOTS_PORT ?? 4399)
// How long `wrangler dev` may take to start answering.
const PREVIEW_START_MS = 60_000
const CONCURRENCY = Number(process.env.OG_SCREENSHOTS_CONCURRENCY ?? 5)
// Reload each worker's page every N captures to release accumulated memory.
const RELOAD_EVERY = Number(process.env.OG_SCREENSHOTS_RELOAD_EVERY ?? 200)
// Wall-clock ceiling for the rendering pass. Whatever is not rendered by then
// keeps the site-wide default og:image — a partial run is always preferable to
// a failed deploy (see the header note).
const BUDGET_MS = Number(process.env.OG_SCREENSHOTS_BUDGET_MS ?? 10 * 60_000)
// The island mounts inside its `[data-island]` placeholder, so the card is a
// descendant of #og-card rather than a child — match it by its own marker.
const CARD_SELECTOR = '[data-og-card]'
// The frame IS the card: 1200×630 at the page's top-left (og-card.page.tsx).
const FRAME_SELECTOR = '#og-card'
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
// Incremental cache.
//
// The build wipes dist/ (`emptyOutDir`), so "skip unchanged" needs the PNGs to survive
// OUTSIDE dist: a cache dir under node_modules/.cache keyed by a manifest of
// content hashes. Hash input = the entity's JSON + SCRIPT_VERSION — bump
// SCRIPT_VERSION whenever the card RENDERING changes (og-card page, OgCard and
// the ChapterBand it is built from, fonts, dimensions), since the entity data
// alone can't see those.
//
// Unchanged entity + cached PNG → copy into dist, no screenshot.
// ---------------------------------------------------------------------------
const SCRIPT_VERSION = 7
const CACHE_DIR = join(APP_ROOT, 'node_modules', '.cache', 'srd-og')

/**
 * `bun run preview` on PORT, resolved once it answers. Pinned to 127.0.0.1 so
 * it matches the base the pages are loaded from exactly (binding `localhost`
 * can resolve to ::1 on some machines).
 */
async function startPreview(): Promise<{ kill: () => void }> {
  const proc = Bun.spawn(['bun', 'run', 'preview', '--port', String(PORT), '--ip', '127.0.0.1'], {
    cwd: APP_ROOT,
    stdout: 'ignore',
    stderr: 'inherit',
  })
  const deadline = Date.now() + PREVIEW_START_MS
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`bun run preview exited with ${proc.exitCode}`)
    const up = await fetch(`http://127.0.0.1:${PORT}/`).then(
      (r) => r.ok,
      () => false
    )
    if (up) return { kill: () => proc.kill() }
    await Bun.sleep(250)
  }
  proc.kill()
  throw new Error(`bun run preview did not answer on ${PORT} within ${PREVIEW_START_MS} ms`)
}
const MANIFEST_PATH = join(CACHE_DIR, 'manifest.json')

type Manifest = Record<string, string> // "schemaId/itemId" -> content hash

/**
 * A page/context/browser that will not close is abandoned: the recovery path
 * opens a fresh one regardless, and the process exits at the end of the run.
 */
function ignoreCloseError(): void {
  // Deliberately nothing — see above.
}

function readManifest(): Manifest {
  if (process.env.OG_SCREENSHOTS_NO_CACHE) return {}
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
  } catch {
    // Missing or unparseable cache: rebuild every screenshot rather than fail.
    return {}
  }
}

function entityHash(item: unknown): string {
  // The canvas size is in the key, so changing it self-invalidates instead of
  // quietly serving PNGs rendered at the old geometry.
  return createHash('sha1')
    .update(`v${SCRIPT_VERSION}:${OG_WIDTH}x${OG_HEIGHT}:`)
    .update(JSON.stringify(item))
    .digest('hex')
}

function cachePngPath(entity: Entity): string {
  return entity.patternId
    ? join(CACHE_DIR, entity.schemaId, entity.itemId, 'pattern', `${entity.patternId}.og.png`)
    : join(CACHE_DIR, entity.schemaId, `${entity.itemId}.og.png`)
}

function distPngPath(entity: Entity): string {
  return join(DIST_DIR, ogImagePath(entity.schemaId, entity.itemId, entity.patternId))
}

/**
 * One renderable target. A chassis pattern is its own kind of entity here — its
 * own page, its own card view, its own og:image — distinguished by `patternId`.
 */
type Entity = { schemaId: string; itemId: string; patternId?: string; hash: string }

/** Stable identity for a target, matching the island's `data-og-current` key. */
function entityKey(entity: Entity): string {
  return entity.patternId
    ? `${entity.schemaId}/${entity.itemId}/pattern/${entity.patternId}`
    : `${entity.schemaId}/${entity.itemId}`
}

function itemHtmlPath(entity: Entity): string {
  const base = join(DIST_DIR, 'schema', entity.schemaId, 'item', entity.itemId)
  return entity.patternId
    ? join(base, 'pattern', entity.patternId, 'index.html')
    : join(base, 'index.html')
}

/**
 * Point one built item page at its own og:image.
 *
 * The build emits the site-wide default for every page, and this pass upgrades
 * ONLY the pages whose PNG actually landed in dist. That ordering is the safety
 * property: generation being skipped, budget-capped, or failing outright leaves
 * the default in place instead of advertising an image that 404s.
 *
 * Returns false if the page didn't contain the expected default URL, which
 * means BaseLayout's meta block changed shape — surfaced as a warning rather
 * than silently doing nothing.
 */
function pointPageAtOgImage(entity: Entity): boolean {
  const htmlPath = itemHtmlPath(entity)
  // Read directly and handle the failure, rather than existsSync-then-read:
  // the check-then-use pattern is a file-system race (CodeQL js/file-system-race)
  // and buys nothing here, since the read can fail for reasons a stat can't rule out.
  let html: string
  try {
    html = readFileSync(htmlPath, 'utf8')
  } catch {
    // Unreadable page: treat as "not using the default image" and skip it.
    return false
  }
  const defaultUrl = new URL(DEFAULT_OG_IMAGE, SITE_URL).href
  if (!html.includes(defaultUrl)) return false
  const ownUrl = new URL(ogImagePath(entity.schemaId, entity.itemId, entity.patternId), SITE_URL)
    .href
  writeFileSync(htmlPath, html.split(defaultUrl).join(ownUrl))
  return true
}

function log(msg: string) {
  // biome-ignore lint/suspicious/noConsole: build-time CLI script — progress logging to stdout is the point
  console.log(`[og-screenshots] ${msg}`)
}

async function run() {
  if (!process.env.OG_SCREENSHOTS) {
    log('OG_SCREENSHOTS not set — skipping og:image generation (see script header).')
    return
  }

  // Items and chassis patterns alike — a pattern is its own kind of entity, so
  // it gets its own card rather than inheriting the chassis banner.
  const allEntities: Entity[] = [
    ...getItemStaticPaths().map((p) => ({
      schemaId: p.params.schemaId,
      itemId: p.params.itemId,
      hash: entityHash(p.props.item),
    })),
    ...getPatternStaticPaths().map((p) => ({
      schemaId: p.params.schemaId,
      itemId: p.params.itemId,
      patternId: p.params.patternId,
      // Hash the PATTERN, not the chassis: two patterns of one chassis must not
      // collide, and editing a pattern has to invalidate only its own card.
      hash: entityHash(p.props.pattern),
    })),
  ]
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
    const key = entityKey(entity)
    const cached = cachePngPath(entity)
    if (previous[key] === entity.hash && existsSync(cached)) {
      mkdirSync(dirname(distPngPath(entity)), { recursive: true })
      copyFileSync(cached, distPngPath(entity))
      restored++
    } else {
      entities.push(entity)
    }
  }

  // Manifest for THIS build: start from what actually survived into dist, and
  // add each entity as it renders. Anything unrendered (failed, or cut off by
  // the budget) stays out, so the next run retries it instead of "restoring" a
  // PNG that was never written.
  const nextManifest: Manifest = {}
  for (const entity of allEntities) {
    const key = entityKey(entity)
    if (previous[key] === entity.hash && existsSync(cachePngPath(entity))) {
      nextManifest[key] = entity.hash
    }
  }
  const writeManifest = () => {
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest))
  }

  // Every page whose PNG is already in dist can be pointed at it now; the rest
  // are linked as they render.
  const linkAllRendered = () => {
    let linked = 0
    let mismatched = 0
    for (const entity of allEntities) {
      if (!existsSync(distPngPath(entity))) continue
      if (pointPageAtOgImage(entity)) linked++
      else mismatched++
    }
    if (mismatched > 0) {
      log(
        `WARNING: ${mismatched} page(s) had no default og:image URL to replace — BaseLayout's meta block may have changed. Those pages keep the default.`
      )
    }
    return linked
  }

  if (restored > 0) log(`${restored}/${allEntities.length} unchanged — restored from cache.`)
  if (entities.length === 0) {
    writeManifest()
    log(`all og:images restored from cache — ${linkAllRendered()} page(s) linked.`)
    return
  }
  log(`generating ${entities.length} og:images (${CONCURRENCY} concurrent)…`)

  let chromium: typeof import('@playwright/test').chromium
  try {
    ;({ chromium } = await import('@playwright/test'))
  } catch (err) {
    throw new Error('Playwright not importable — run `bun --filter srd og:install-browser`.', {
      cause: err,
    })
  }

  const preview = await startPreview()

  type Context = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>>
  type Page = import('@playwright/test').Page

  const base = `http://127.0.0.1:${PORT}`
  const failures: { entity: Entity; error: string }[] = []
  const deadline = Date.now() + BUDGET_MS
  let generated = 0
  let done = 0
  let budgetHit = false

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
    const key = entityKey(entity)
    await page.evaluate(
      ([schema, item, pattern]) => window.__ogSetEntity?.(schema, item, pattern || undefined),
      [entity.schemaId, entity.itemId, entity.patternId ?? ''] as [string, string, string]
    )
    // Wait until that exact entity is the one committed to the DOM.
    await page.waitForFunction(
      (k) => document.documentElement.getAttribute('data-og-current') === k,
      key,
      { timeout: NAV_TIMEOUT }
    )
    const card = page.locator(CARD_SELECTOR)
    await card.waitFor({ state: 'visible', timeout: NAV_TIMEOUT })
    await page.evaluate(() => document.fonts.ready)
    // The foot's mark is an image — capturing before it decodes would ship a
    // preview with a blank slot. Waiting on decode() (not just .complete) also
    // covers images served from the memory cache on a later swap.
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#og-card img'))
      await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))
    })
    // One paint frame so the swapped card is fully rendered before capture.
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    )

    const shot = await page.locator(FRAME_SELECTOR).screenshot({ type: 'png' })
    const outPath = distPngPath(entity)
    mkdirSync(dirname(outPath), { recursive: true })
    // The frame is the canvas, so there is nothing to fit.
    // Palette quantisation is near-lossless on these cards — flat brand colours,
    // text and line art, well inside 256 colours — and cuts the payload ~3×
    // (85MB → ~28MB across the corpus), which matters for a static deploy.
    await sharp(shot).png({ palette: true, quality: 90, effort: 8 }).toFile(outPath)

    // Mirror into the incremental cache so the next build can skip this one.
    const cached = cachePngPath(entity)
    mkdirSync(dirname(cached), { recursive: true })
    copyFileSync(outPath, cached)
    nextManifest[key] = entity.hash
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.OG_CHROME_PATH || undefined,
      args: LAUNCH_ARGS,
    })

    try {
      const context = await browser.newContext({
        // The card's own size at a device scale of 1: the PNG is the card,
        // pixel for pixel.
        viewport: { width: OG_WIDTH, height: OG_HEIGHT },
        deviceScaleFactor: 1,
      })

      let cursor = 0
      const worker = async () => {
        let page = await freshPage(context)
        let sinceReload = 0
        try {
          for (;;) {
            if (Date.now() > deadline) {
              budgetHit = true
              break
            }
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
                await page.close().catch(ignoreCloseError)
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
              await page.close().catch(ignoreCloseError)
              page = await freshPage(context)
              sinceReload = 0
            }
          }
        } finally {
          await page.close().catch(ignoreCloseError)
        }
      }

      await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker))
      await context.close().catch(ignoreCloseError)
    } finally {
      await browser.close().catch(ignoreCloseError)
    }
  } finally {
    preview.kill()
  }

  writeManifest()
  const linked = linkAllRendered()

  if (budgetHit) {
    log(
      `budget of ${Math.round(BUDGET_MS / 1000)}s reached — ${entities.length - done} entit(ies) keep the default og:image. Re-run to continue; the cache carries what rendered.`
    )
  }
  if (failures.length > 0) {
    for (const f of failures.slice(0, 20)) {
      log(`FAILED ${entityKey(f.entity)}: ${f.error}`)
    }
    log(`${failures.length}/${entities.length} og:image(s) failed to render.`)
  }
  log(
    `done — ${generated} rendered, ${restored} restored from cache, ${linked} page(s) pointed at their own og:image.`
  )
}

// Never fail the build: a missing og:image degrades to the site-wide default,
// which is not worth losing a deploy over (see the header note on #482).
run().catch((err) => {
  console.error('[og-screenshots]', err)
  log('og:image generation failed — entity pages fall back to the default og:image.')
})
