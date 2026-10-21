#!/usr/bin/env bun
/**
 * gallery — the screenshot gallery: every page in `GALLERY_SECTIONS` at
 * desktop (1440×900) and phone (390×844), each page's link preview, and
 * the app signed in, written as `index.html` beside its shots.
 *
 *   bun run gallery --base <url> [--signed-in] [--out <dir>]
 *                   [--sha <sha>] [--pr <n>] [--linkable]
 *
 * `--base` is the site's origin; every page's path is on it, the app's
 * under `/build` (`APP_BASE`). `gallery.yml` (dispatched by hand) runs it
 * against a branch's own build, served on localhost (the one `dist`, its
 * App built against a throwaway Convex backend with the test sign-in), and
 * `gallery-pages.yml` publishes the result to GitHub Pages.
 *
 * - A link preview is rendered the way `apps/web/scripts/og-screenshots.ts`
 *   renders it (`/og-card/`, `window.__ogSetEntity`), so the gallery shows the
 *   PR's cards, not whatever production last generated. A page whose og:image
 *   is the site default fetches that file from the same build.
 * - `--signed-in` signs a fresh account up through the test seam
 *   (`gates/lib/testSignIn.ts`), seeds it as the layout gates' walk seeds
 *   theirs (`gates/lib/seedAccount.ts`: Starter Set copies on the Training
 *   Bay, a Game with Bonesaw in it, an NPC), then shoots the `signedIn` pages in
 *   that one browser context: the session's refresh token rotates on use, so a
 *   second context restored from it would be signed out.
 * - A page that fails is listed at the top of the gallery and the run exits 1;
 *   every other page is still shot.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { launchBrowser } from 'gates/lib/chromium'
import type { OgMeta } from 'gates/lib/galleryHtml'
import { renderGallery } from 'gates/lib/galleryHtml'
import type { GalleryPage } from 'gates/lib/galleryPages'
import { APP_BASE, GALLERY_SECTIONS, isAppPath, pageSlug } from 'gates/lib/galleryPages'
import type { Seed } from 'gates/lib/seedAccount'
import { resolveSeedPath, seedAccount } from 'gates/lib/seedAccount'
import type { SeamAccount } from 'gates/lib/testSignIn'
import { signInThroughSeam } from 'gates/lib/testSignIn'
import { isSchemaName } from 'salvageunion-reference'

export type GalleryArgs = {
  /** The site's origin, e.g. `http://localhost:4321`. */
  base: string
  signedIn: boolean
  out: string
  sha: string
  pr?: number
  linkable: boolean
}

const USAGE =
  'usage: bun run gallery --base <url> [--signed-in] [--out <dir>] [--sha <sha>] [--pr <n>] [--linkable]'

const VIEWS = [
  { key: 'desk', width: 1440, height: 900 },
  { key: 'phone', width: 390, height: 844 },
] as const

const GALLERY_PAGES = GALLERY_SECTIONS.flatMap((s) => s.pages)

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/** Parses argv (after the script). Throws with the usage line on a bad argument. */
export function parseGalleryArgs(argv: readonly string[]): GalleryArgs {
  const args: Partial<GalleryArgs> = { signedIn: false, linkable: false, sha: 'local' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    const [flag, inline] = arg.split('=', 2)
    const value = () => {
      const v = inline ?? argv[++i]
      if (!v) throw new Error(`${flag} needs a value\n${USAGE}`)
      return v
    }
    if (flag === '--base') args.base = trimSlash(value())
    else if (flag === '--signed-in') args.signedIn = true
    else if (flag === '--linkable') args.linkable = true
    else if (flag === '--out') args.out = resolve(value())
    else if (flag === '--sha') args.sha = value()
    else if (flag === '--pr') {
      const n = Number(value())
      if (!Number.isInteger(n) || n <= 0) throw new Error(`--pr must be a PR number\n${USAGE}`)
      args.pr = n
    } else throw new Error(`unknown argument ${arg}\n${USAGE}`)
  }
  if (!args.base) throw new Error(`--base is required\n${USAGE}`)
  return {
    base: args.base,
    signedIn: args.signedIn ?? false,
    out: args.out ?? resolve('.gallery'),
    sha: args.sha ?? 'local',
    pr: args.pr,
    linkable: args.linkable ?? false,
  }
}

/**
 * The entity a reference page shows, when it has a card of its own. A plain
 * build emits the DEFAULT og:image on every page (.claude/rules/srd-og-images.md);
 * the deploy's OG render (`.github/actions/build-site`) rewrites it only for
 * the cards it rendered, so the gallery reads the entity off the page's own path.
 */
export function pageEntity(
  path: string
): { schema: string; item: string; pattern?: string } | undefined {
  const m = path.match(/^\/([^/]+)\/([^/]+)\/(?:pattern\/([^/]+)\/)?$/)
  // Pages sit at the root (`/chassis/mule/`), so the first segment is a schema
  // only when it names one: `/bot/terms/` has the same shape.
  if (!m?.[1] || !m[2] || !isSchemaName(m[1])) return undefined
  return { schema: m[1], item: m[2], ...(m[3] ? { pattern: m[3] } : {}) }
}

const settle = (page: Page, ms: number) => page.waitForTimeout(ms)

/** The page's globals these callbacks touch, run in the browser (tools/ has no DOM lib). */
type Attr = { getAttribute(name: string): string | null }
type InPage = {
  document: {
    querySelector(selector: string): Attr | null
    documentElement: { hasAttribute(name: string): boolean }
    fonts: { ready: Promise<unknown> }
  }
  __ogSetEntity?: (schema: string, item: string, pattern?: string) => void
}

async function readOg(
  page: Page
): Promise<{ image?: string; title?: string; description?: string }> {
  return page.evaluate(() => {
    const meta = (k: string) =>
      (globalThis as unknown as InPage).document
        .querySelector(`meta[property="${k}"]`)
        ?.getAttribute('content') ?? undefined
    return { image: meta('og:image'), title: meta('og:title'), description: meta('og:description') }
  })
}

/** Renders one entity's card on `/og-card/` and writes it to `file`. */
async function renderOgCard(
  context: BrowserContext,
  base: string,
  entity: NonNullable<ReturnType<typeof pageEntity>>,
  file: string
): Promise<void> {
  const page = await context.newPage()
  try {
    await page.setViewportSize({ width: 1200, height: 630 })
    await page.goto(`${base}/og-card/`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() =>
      (globalThis as unknown as InPage).document.documentElement.hasAttribute('data-og-ready')
    )
    await page.evaluate(
      ([s, i, p]) => (globalThis as unknown as InPage).__ogSetEntity?.(s, i, p || undefined),
      [entity.schema, entity.item, entity.pattern ?? ''] as const
    )
    await page.locator('[data-og-card]').waitFor({ state: 'visible' })
    await page.evaluate(() => (globalThis as unknown as InPage).document.fonts.ready)
    await settle(page, 500)
    await page.locator('#og-card').screenshot({ path: file, type: 'png' })
  } finally {
    await page.close()
  }
}

async function shootPage(page: Page, url: string, file: (view: string) => string, edit: boolean) {
  for (const view of VIEWS) {
    await page.setViewportSize({ width: view.width, height: view.height })
    const res = await page.goto(url, { waitUntil: 'networkidle' })
    if (res && res.status() >= 400) throw new Error(`${url} answered ${res.status()}`)
    await settle(page, 1500)
    if (edit) {
      const control = page
        .getByRole('radio', { name: 'Edit' })
        .or(page.getByRole('button', { name: 'Edit', exact: true }))
        .first()
      if (await control.count()) {
        await control.click()
        await settle(page, 800)
      }
    }
    await page.screenshot({ path: file(view.key), type: 'jpeg', quality: 72 })
  }
}

/** The app's root page on `base`, with its trailing slash. */
export function appRoot(base: string): string {
  return `${base}${APP_BASE}/`
}

/**
 * Signs a fresh test account up through the seam and seeds it
 * (`gates/lib/seedAccount.ts`, the one seed the e2e walk signs in to). Also
 * `tools/dev-backend.ts`'s seed, with its fixed account.
 */
export async function seed(
  page: Page,
  base: string,
  account: SeamAccount = { email: `gallery-${Date.now()}@example.com`, password: 'gallery-pass-1' }
): Promise<Seed> {
  await page.goto(appRoot(base), { waitUntil: 'networkidle' })
  await signInThroughSeam(page, account)
  return await seedAccount(page, base)
}

/** One page to shoot: its file stem and the URL it is shot from. */
export type GalleryTarget = { page: GalleryPage; slug: string; url: string }

/** The signed-out pages, each on `base`. */
export function signedOutTargets(base: string): GalleryTarget[] {
  return GALLERY_PAGES.filter((p) => !p.signedIn).map((page) => ({
    page,
    slug: pageSlug(page),
    url: `${base}${page.path}`,
  }))
}

/** The signed-in pages with the seed's placeholders resolved, and a failure for each the seed did not make. */
export function signedInTargets(
  base: string,
  seeded: Partial<Seed>
): { targets: GalleryTarget[]; failures: string[] } {
  const targets: GalleryTarget[] = []
  const failures: string[] = []
  for (const page of GALLERY_PAGES.filter((p) => p.signedIn)) {
    const path = resolveSeedPath(page.path, seeded)
    if (path) targets.push({ page, slug: pageSlug(page), url: `${base}${path}` })
    else failures.push(`${page.path}: the seed made no such entity`)
  }
  return { targets, failures }
}

/**
 * Where a page's link-preview image comes from: its entity's card rendered on
 * `/og-card/`, the og:image file it names fetched from the same build, or
 * nothing.
 */
export function ogSource(
  page: GalleryPage,
  base: string,
  image: string | undefined
):
  | { kind: 'card'; entity: NonNullable<ReturnType<typeof pageEntity>> }
  | { kind: 'file'; url: string }
  | undefined {
  const entity = isAppPath(page.path) ? undefined : pageEntity(page.path)
  if (entity) return { kind: 'card', entity }
  // The image's own path, base included, on the origin the gallery shot.
  if (image) return { kind: 'file', url: `${new URL(base).origin}${new URL(image).pathname}` }
  return undefined
}

/** A failure's line in the gallery: what failed, then the first line of why. */
export const failureLine = (what: string, error: unknown): string =>
  `${what}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`

/** The capture time the gallery prints, to the minute. */
export const capturedAtStamp = (date: Date): string =>
  `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`

export type GalleryCapture = {
  shot: ReadonlySet<string>
  og: ReadonlyMap<string, OgMeta>
  failures: readonly string[]
}

/** Writes `index.html` and `gallery.json` into `args.out`; returns the exit code (1 if anything failed). */
export function writeGallery(
  args: GalleryArgs,
  capture: GalleryCapture,
  capturedAt: string
): number {
  const { shot, og, failures } = capture
  mkdirSync(args.out, { recursive: true })
  writeFileSync(
    join(args.out, 'index.html'),
    renderGallery(
      { sections: GALLERY_SECTIONS, shot, og, failures },
      {
        sha: args.sha,
        pr: args.pr,
        base: args.base,
        linkable: args.linkable,
        capturedAt,
      }
    )
  )
  writeFileSync(
    join(args.out, 'gallery.json'),
    JSON.stringify({ pr: args.pr ?? null, sha: args.sha, capturedAt, pages: shot.size, failures })
  )
  console.log(`\n[gallery] ${shot.size} pages, ${failures.length} not captured → ${args.out}`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  return failures.length ? 1 : 0
}

/** Fetches a default og:image into `file`; true when it answered with an image. */
export async function fetchOgImage(url: string, file: string): Promise<boolean> {
  const res = await fetch(url)
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return false
  await Bun.write(file, await res.arrayBuffer())
  return true
}

/** The browser and clock `run` uses, and where its progress dots go; the defaults are real. */
export type GalleryDeps = {
  launch?: () => Promise<Browser>
  /** Signs the account up and seeds it (`seed`). */
  seed?: (page: Page, base: string) => Promise<Partial<Seed>>
  now?: () => Date
  progress?: (dot: string) => void
}

/** Shoot every page into `args.out` and write the gallery; returns the exit code. */
async function run(
  args: GalleryArgs,
  {
    launch = launchBrowser,
    seed: seedWith = seed,
    now = () => new Date(),
    progress = (dot) => process.stdout.write(dot),
  }: GalleryDeps = {}
): Promise<number> {
  const shots = join(args.out, 'shots')
  mkdirSync(shots, { recursive: true })
  const shot = new Set<string>()
  const og = new Map<string, OgMeta>()
  const failures: string[] = []
  const file = (slug: string) => (view: string) => join(shots, `${slug}-${view}.jpg`)
  const browser: Browser = await launch()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    for (const t of signedOutTargets(args.base)) {
      try {
        await shootPage(page, t.url, file(t.slug), false)
        shot.add(t.slug)
        const meta = await readOg(page)
        const source = ogSource(t.page, args.base, meta.image)
        const ogFile = join(shots, `${t.slug}-og.png`)
        let image = false
        if (source?.kind === 'card') {
          await renderOgCard(context, args.base, source.entity, ogFile)
          image = true
        } else if (source) image = await fetchOgImage(source.url, ogFile)
        og.set(t.slug, { title: meta.title, description: meta.description, image })
      } catch (error) {
        failures.push(failureLine(t.page.path, error))
      }
      progress('.')
    }
    await context.close()

    if (args.signedIn) {
      const signed = await browser.newContext()
      const sp = await signed.newPage()
      let seeded: Partial<Seed> = {}
      try {
        seeded = await seedWith(sp, args.base)
      } catch (error) {
        failures.push(failureLine('seed', error))
      }
      const planned = signedInTargets(args.base, seeded)
      failures.push(...planned.failures)
      for (const t of planned.targets) {
        try {
          await shootPage(sp, t.url, file(t.slug), !!t.page.edit)
          shot.add(t.slug)
        } catch (error) {
          failures.push(failureLine(`signed in ${t.page.path}`, error))
        }
        progress('.')
      }
      await signed.close()
    }
  } finally {
    await browser.close()
  }
  return writeGallery(args, { shot, og, failures }, capturedAtStamp(now()))
}

/** Parse `argv` and run; a bad argument is exit 2. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  deps: GalleryDeps & { error?: (line: string) => void } = {}
): Promise<number> {
  let args: GalleryArgs
  try {
    args = parseGalleryArgs(argv)
  } catch (error) {
    const report = deps.error ?? console.error
    report((error as Error).message)
    return 2
  }
  return run(args, deps)
}

if (import.meta.main) process.exit(await main())
