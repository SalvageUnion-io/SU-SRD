/**
 * Build-time OG-image generator.
 *
 * Renders the REAL catalog tile for every entity — the shared `CatalogTile` the
 * schema index grid emits — and composes it onto a 1200×630 canvas at
 * `dist/schema/{schemaId}/item/{itemId}.og.png`, the path each page references
 * as its og:image.
 *
 * Chassis PATTERNS are covered as entities in their own right: a pattern has its
 * own page, its own card view (the card takes the chassis as `data` plus the
 * `pattern` it renders as the subject) and its own provenance, so it gets its
 * own tile at `…/item/{itemId}/pattern/{patternId}.og.png` rather than
 * inheriting the chassis image.
 *
 * Pipeline:
 *   1. Enumerate targets via getItemStaticPaths + getPatternStaticPaths (the
 *      same sources as the routes, so every og.png path matches a real page).
 *   2. Serve the freshly-built `dist/` with `astro preview`.
 *   3. Drive headless chromium (Playwright). Each worker loads `/og-card/` ONCE
 *      (game-data corpus + island loaded a single time) and re-renders each
 *      entity in place via `window.__ogSetEntity` — far faster and lighter than
 *      a navigation per entity, and it avoids the under-load dynamic-import
 *      failures that per-navigation rendering hit on the Netlify builder.
 *   4. Fit the tile to the canvas: re-flow the card at each candidate masonry
 *      width and keep the one that covers the most of the 1200×630 frame
 *      (`pickTileWidth`). The grid tile is fluid, so every candidate is a real
 *      catalog layout — this picks which of them to photograph.
 *   5. Screenshot the padded FRAME around the tile (not the viewport, and not
 *      the tile box itself — the card is `overflow-visible` and its decorations
 *      overhang) at a device scale factor that lands the narrowest candidate at
 *      exactly OG_WIDTH, then `contain`-fit it onto the canvas with sharp,
 *      matted in the surface the Catalog view puts behind its tiles.
 *
 * WHY THIS IS OPT-IN (read before re-enabling it in a deploy):
 * an earlier version of this script ran on every Netlify build and rendered the
 * full entity card for ~1.5k entities. The PNG cache lived in node_modules, so a
 * cold builder re-rendered all of them and the deploy blew the build limit —
 * every srd deploy failed, and the feature was deleted (#482). It is now:
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
import {
  CATALOG_MIN_FRAME_WIDTH,
  CATALOG_TILE_MAX_WIDTH,
  CATALOG_TILE_MIN_WIDTH,
  CATALOG_TILE_PADDING,
  CATALOG_TILE_WIDTHS,
  CATALOG_VIEWPORT_WIDTH,
  OG_HEIGHT,
  OG_WIDTH,
  ogImagePath,
  pickTileWidth,
} from '../src/lib/ogCard'
import { getItemStaticPaths, getPatternStaticPaths } from '../src/lib/staticPaths'

const PORT = Number(process.env.OG_SCREENSHOTS_PORT ?? 4399)
const CONCURRENCY = Number(process.env.OG_SCREENSHOTS_CONCURRENCY ?? 5)
// Reload each worker's page every N captures to release accumulated memory.
const RELOAD_EVERY = Number(process.env.OG_SCREENSHOTS_RELOAD_EVERY ?? 200)
// Wall-clock ceiling for the rendering pass. Whatever is not rendered by then
// keeps the site-wide default og:image — a partial run is always preferable to
// a failed deploy (see the header note).
const BUDGET_MS = Number(process.env.OG_SCREENSHOTS_BUDGET_MS ?? 10 * 60_000)
// The island mounts inside an <astro-island> wrapper, so the tile is a
// descendant of #og-card rather than a child — match it by its own marker.
const TILE_SELECTOR = '[data-og-tile]'
// …but CAPTURE the padded frame, not the tile: the card is `overflow-visible`
// and a pattern tile's chassis name-tab overhangs its box, which an
// element-scoped screenshot of the tile would slice off.
const FRAME_SELECTOR = '#og-card'
const NAV_TIMEOUT = 30_000
// Render the NARROWEST candidate frame at exactly OG_WIDTH device pixels. The
// browser rasterises at this scale (real layout, not an image resize), so the
// narrowest frame is written with no resampling at all and every wider one is
// rasterised bigger than the canvas and downsampled — never upscaled.
const SCALE = OG_WIDTH / CATALOG_MIN_FRAME_WIDTH
// Viewport height only has to be generous: the capture is element-scoped, and
// Playwright captures an element taller than the viewport in full. The widest
// candidate tile still fits inside CATALOG_VIEWPORT_WIDTH, and the whole
// viewport is rasterised at SCALE, so this is the memory knob — keep it tight.
const VIEWPORT_HEIGHT = Number(process.env.OG_SCREENSHOTS_VIEWPORT_HEIGHT ?? 1000)
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
// `astro build` wipes dist/, so "skip unchanged" needs the PNGs to survive
// OUTSIDE dist: a cache dir under node_modules/.cache keyed by a manifest of
// content hashes. Hash input = the entity's JSON + SCRIPT_VERSION — bump
// SCRIPT_VERSION whenever the card RENDERING changes (og-card page, the
// ReferenceEntityCard stack in component-lib, fonts, dimensions), since the
// entity data alone can't see those.
//
// Unchanged entity + cached PNG → copy into dist, no screenshot.
// ---------------------------------------------------------------------------
const SCRIPT_VERSION = 6
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
  // Every geometry input that changes the OUTPUT is in the key — the width
  // ladder, the padding and the layout viewport — so adjusting any of them
  // self-invalidates instead of quietly serving PNGs rendered at the old
  // geometry. (The width is CHOSEN per entity, so the key carries the ladder
  // that choice is made from, not the chosen width.)
  return createHash('sha1')
    .update(
      `v${SCRIPT_VERSION}:${OG_WIDTH}x${OG_HEIGHT}@${CATALOG_TILE_MIN_WIDTH}-${CATALOG_TILE_MAX_WIDTH}x${CATALOG_TILE_WIDTHS.length}+${CATALOG_TILE_PADDING}vw${CATALOG_VIEWPORT_WIDTH}:`
    )
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
 * Astro emits the site-wide default for every page, and this pass upgrades ONLY
 * the pages whose PNG actually landed in dist. That ordering is the safety
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

async function run() {
  if (!process.env.OG_SCREENSHOTS) {
    log('OG_SCREENSHOTS not set — skipping og:image generation (see script header).')
    return
  }

  // Items and chassis patterns alike — a pattern is its own kind of entity, so
  // it gets its own Catalog tile and its own preview rather than inheriting the
  // chassis banner.
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
      // collide, and editing a pattern has to invalidate only its own tile.
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
  const overhangs: { key: string; overhang: number }[] = []
  // Which tile width the canvas fit chose, per entity. Reported at the end: the
  // fit is a heuristic over real measurements, and an unreported heuristic that
  // quietly collapses onto one width (or onto the ladder's edge) looks exactly
  // like a working one.
  const widthPicks = new Map<number, number>()
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
    const tile = page.locator(TILE_SELECTOR)
    await tile.waitFor({ state: 'visible', timeout: NAV_TIMEOUT })
    await page.evaluate(() => document.fonts.ready)
    // Catalog tiles lead with artwork — capturing before it decodes would ship a
    // preview with a blank image slot. Waiting on decode() (not just .complete)
    // also covers images served from the memory cache on a later swap.
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#og-card img'))
      await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))
    })

    // Fit the tile to the canvas: re-flow this card at every candidate masonry
    // width and keep the one that covers the most of the 1200×630 frame.
    //
    // Per-entity because card height is a step function of width that depends
    // entirely on the content — a prose-heavy class tile keeps shrinking as it
    // widens, while a two-line trait is already canvas-shaped at the grid width
    // and only gets worse. A single fixed width has to letterbox one or the
    // other. Reading getBoundingClientRect forces synchronous layout, so all
    // ~19 candidates are measured in one round-trip with no paint in between.
    const heights = await page.evaluate((widths) => {
      const frame = document.getElementById('og-card')
      const tile = document.querySelector('[data-og-tile]')
      if (!frame || !tile) return []
      return widths.map((w) => {
        frame.style.setProperty('--tileWidth', `${w}px`)
        return tile.getBoundingClientRect().height
      })
    }, CATALOG_TILE_WIDTHS as number[])
    const tileWidth = pickTileWidth(
      heights.map((height, i) => ({ width: CATALOG_TILE_WIDTHS[i] ?? 0, height }))
    )
    await page.evaluate(
      (w) => document.getElementById('og-card')?.style.setProperty('--tileWidth', `${w}px`),
      tileWidth
    )
    widthPicks.set(tileWidth, (widthPicks.get(tileWidth) ?? 0) + 1)

    // One paint frame so the swapped, re-fitted card is fully rendered before capture.
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    )

    // The canvas is matted in the surface the Catalog view puts BEHIND its tiles
    // (`--color-wk-bg`, carried by #og-card), read from the live page rather
    // than hardcoded so a theme change can't leave the OG images on a stale
    // colour.
    const background = await page.evaluate(() => {
      const frame = document.getElementById('og-card')
      return frame ? getComputedStyle(frame).backgroundColor : 'rgb(255,255,255)'
    })

    // Guard the padding rather than trusting it: if a card ever overhangs its
    // box by more than CATALOG_TILE_PADDING, say so instead of silently
    // shipping a clipped preview.
    const overhang = await page.evaluate(() => {
      const el = document.querySelector('[data-og-tile]')
      if (!el) return 0
      const box = el.getBoundingClientRect()
      let worst = 0
      for (const child of Array.from(el.querySelectorAll('*'))) {
        const r = child.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        worst = Math.max(
          worst,
          box.top - r.top,
          box.left - r.left,
          r.right - box.right,
          r.bottom - box.bottom
        )
      }
      return Math.ceil(worst)
    })
    if (overhang > CATALOG_TILE_PADDING) {
      overhangs.push({ key, overhang })
    }

    const shot = await page.locator(FRAME_SELECTOR).screenshot({ type: 'png' })
    const outPath = distPngPath(entity)
    mkdirSync(dirname(outPath), { recursive: true })
    // `contain` pads a tile that fits (no resampling — it was rasterised at
    // exactly OG_WIDTH) and downsamples one taller than the canvas.
    // Palette quantisation is near-lossless on these cards — flat brand colours,
    // text and line art, well inside 256 colours — and cuts the payload ~3×
    // (85MB → ~28MB across the corpus), which matters for a static deploy.
    await sharp(shot)
      .resize(OG_WIDTH, OG_HEIGHT, { fit: 'contain', background })
      .png({ palette: true, quality: 90, effort: 8 })
      .toFile(outPath)

    // Mirror into the incremental cache so the next build can skip this one.
    const cached = cachePngPath(entity)
    mkdirSync(dirname(cached), { recursive: true })
    copyFileSync(outPath, cached)
    nextManifest[key] = entity.hash
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
        // Lay out at the DESKTOP catalog viewport, not at the tile's own width:
        // the card's `md:`/`lg:` variants key off the viewport, so a narrow one
        // captures the mobile stack (artwork above the prose) instead of the
        // tile a desktop reader sees. The capture is element-scoped, so the
        // extra viewport width never lands in the image.
        viewport: { width: CATALOG_VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: SCALE,
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

  writeManifest()
  const linked = linkAllRendered()

  if (budgetHit) {
    log(
      `budget of ${Math.round(BUDGET_MS / 1000)}s reached — ${entities.length - done} entit(ies) keep the default og:image. Re-run to continue; the cache carries what rendered.`
    )
  }
  if (widthPicks.size > 0) {
    const picks = [...widthPicks.entries()].sort((a, b) => a[0] - b[0])
    log(`tile widths chosen: ${picks.map(([w, n]) => `${w}px×${n}`).join(' ')}`)
    // The ladder's top is a CAP, not a choice: piling up there means the widest
    // candidate was still too narrow to be canvas-shaped, so those cards are
    // letterboxed and CATALOG_TILE_MAX_WIDTH is what is holding them back.
    const atMax = widthPicks.get(CATALOG_TILE_MAX_WIDTH) ?? 0
    if (atMax > generated / 10) {
      log(
        `NOTE: ${atMax} card(s) hit the ${CATALOG_TILE_MAX_WIDTH}px ceiling — they would fill more canvas if CATALOG_TILE_MAX_WIDTH rose.`
      )
    }
  }
  if (overhangs.length > 0) {
    const worst = Math.max(...overhangs.map((o) => o.overhang))
    log(
      `WARNING: ${overhangs.length} card(s) overhang their box by up to ${worst}px, beyond the ${CATALOG_TILE_PADDING}px capture padding — those previews are clipped. Raise CATALOG_TILE_PADDING in src/lib/ogCard.ts.`
    )
    for (const o of overhangs.slice(0, 5)) log(`  clipped: ${o.key} (${o.overhang}px)`)
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
