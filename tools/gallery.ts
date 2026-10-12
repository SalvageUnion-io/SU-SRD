#!/usr/bin/env bun
/**
 * gallery — the PR screenshot gallery: every page in `GALLERY_SECTIONS` at
 * desktop (1440×900) and phone (390×844), each srd page's link preview, and
 * ITUN signed in, written as `index.html` beside its shots.
 *
 *   bun run gallery --srd <url> [--itun <url>] [--signed-in] [--out <dir>]
 *                   [--sha <sha>] [--pr <n>] [--linkable]
 *
 * `pr-gallery.yml` runs it on every PR to main against the PR's own builds,
 * served on localhost (srd's `dist`, ITUN's `dist` built against a throwaway
 * Convex backend with the test sign-in), and `pr-gallery-pages.yml` publishes
 * the result to GitHub Pages. It began as the design-refresh review's
 * hand-run Playwright loop over the preview slot.
 *
 * - A link preview is rendered the way `apps/srd/scripts/og-screenshots.ts`
 *   renders it (`/og-card/`, `window.__ogSetEntity`), so the gallery shows the
 *   PR's cards, not whatever production last generated. A page whose og:image
 *   is the site default fetches that file from the same build.
 * - `--signed-in` signs a fresh account up through the test seam
 *   (`__itunTestSignIn`, `apps/itun/e2e/fixtures.ts`), copies Bonesaw, the
 *   Mazona and Tenacity from the Starter Set to its Shelves, starts a Game and
 *   moves Bonesaw in, then shoots the `signedIn` pages in that one browser
 *   context: the session's refresh token rotates on use, so a second context
 *   restored from it would be signed out.
 * - A page that fails is listed at the top of the gallery and the run exits 1;
 *   every other page is still shot.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import type { OgMeta } from 'gates/lib/galleryHtml'
import { renderGallery } from 'gates/lib/galleryHtml'
import type { GalleryPage } from 'gates/lib/galleryPages'
import { GALLERY_SECTIONS, pageSlug } from 'gates/lib/galleryPages'
import { launchBrowser } from './shot'

export type GalleryArgs = {
  srd: string
  itun?: string
  signedIn: boolean
  out: string
  sha: string
  pr?: number
  linkable: boolean
}

const USAGE =
  'usage: bun run gallery --srd <url> [--itun <url>] [--signed-in] [--out <dir>] [--sha <sha>] [--pr <n>] [--linkable]'

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
    if (flag === '--srd') args.srd = trimSlash(value())
    else if (flag === '--itun') args.itun = trimSlash(value())
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
  if (!args.srd) throw new Error(`--srd is required\n${USAGE}`)
  if (args.signedIn && !args.itun) throw new Error(`--signed-in needs --itun\n${USAGE}`)
  return {
    srd: args.srd,
    itun: args.itun,
    signedIn: args.signedIn ?? false,
    out: args.out ?? resolve('.gallery'),
    sha: args.sha ?? 'local',
    pr: args.pr,
    linkable: args.linkable ?? false,
  }
}

/**
 * The entity an srd page shows, when it has a card of its own. A plain build
 * emits the DEFAULT og:image on every page (srd's CLAUDE.md, "Social preview
 * images"); the deploy's `og-srd` job rewrites it only for the cards it
 * rendered, so the gallery reads the entity off the page's own path.
 */
export function pageEntity(
  path: string
): { schema: string; item: string; pattern?: string } | undefined {
  const m = path.match(/^\/schema\/([^/]+)\/item\/([^/]+)\/(?:pattern\/([^/]+)\/)?$/)
  if (!m?.[1] || !m[2]) return undefined
  return { schema: m[1], item: m[2], ...(m[3] ? { pattern: m[3] } : {}) }
}

type Seeded = Record<'pilot' | 'mech' | 'crawler' | 'game', string>

/** A signed-in page's path with its `:kind` placeholder resolved, or undefined if the seed did not make it. */
export function resolvePath(path: string, seeded: Partial<Seeded>): string | undefined {
  if (!path.startsWith(':')) return path
  return seeded[path.slice(1) as keyof Seeded]
}

const settle = (page: Page, ms: number) => page.waitForTimeout(ms)

/** The page's globals these callbacks touch, run in the browser (tools/ has no DOM lib). */
type Attr = { getAttribute(name: string): string | null }
type InPage = {
  document: {
    querySelector(selector: string): Attr | null
    querySelectorAll(selector: string): Iterable<Attr>
    documentElement: { hasAttribute(name: string): boolean }
    fonts: { ready: Promise<unknown> }
  }
  __ogSetEntity?: (schema: string, item: string, pattern?: string) => void
  __itunTestSignIn?: (email: string, password: string) => Promise<void>
}
type SelectLike = { options: Iterable<{ textContent: string | null; value: string }> }

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

/** Renders one srd entity's card on `/og-card/` and writes it to `file`. */
async function renderOgCard(
  context: BrowserContext,
  srd: string,
  entity: NonNullable<ReturnType<typeof pageEntity>>,
  file: string
): Promise<void> {
  const page = await context.newPage()
  try {
    await page.setViewportSize({ width: 1200, height: 630 })
    await page.goto(`${srd}/og-card/`, { waitUntil: 'domcontentloaded' })
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

/**
 * A path the app rendered (`/build/sheet/pilot/x`) as the route the gallery's
 * pages name (`/sheet/pilot/x`): `--itun` already carries ITUN's base
 * (`http://localhost:5173/build`, ADR-048), and the targets append the route.
 */
export function routeOf(itun: string, path: string): string {
  const base = new URL(itun).pathname.replace(/\/+$/, '')
  return base !== '' && path.startsWith(`${base}/`) ? path.slice(base.length) : path
}

/**
 * ITUN's root page with its trailing slash: `--itun` arrives trimmed
 * (`http://localhost:5173/build`), and `vite preview` answers the bare base
 * with a 404 where production's Worker redirects it.
 */
export function rootOf(itun: string): string {
  return `${itun}/`
}

/** Signs a fresh test account up and gives it something to edit. */
async function seed(page: Page, itun: string): Promise<Partial<Seeded>> {
  await page.goto(rootOf(itun), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => '__itunTestSignIn' in (globalThis as unknown as InPage), null, {
    timeout: 30_000,
  })
  await page.evaluate(async (email) => {
    await (globalThis as unknown as InPage).__itunTestSignIn?.(email, 'gallery-pass-1')
  }, `gallery-${Date.now()}@example.com`)
  await page.getByRole('button', { name: 'Games' }).first().waitFor({ timeout: 30_000 })
  for (const label of ['Copy Bonesaw to…', 'Copy Mazona to…', "Copy Crawler #430 'Tenacity' to…"]) {
    await page.goto(`${itun}/starter`, { waitUntil: 'networkidle' })
    const select = page.locator(`select[aria-label="${label}"]`).first()
    const shelves = await select.evaluate(
      (s) =>
        [...(s as unknown as SelectLike).options].find((o) => o.textContent === 'Shelves')?.value
    )
    if (!shelves) throw new Error(`${label} offers no Shelves`)
    await select.selectOption(shelves)
    await page.getByRole('button', { name: 'Make a copy' }).click()
    await page
      .getByText(/^Copied /)
      .first()
      .waitFor({ timeout: 20_000 })
  }
  await page.goto(rootOf(itun), { waitUntil: 'networkidle' })
  await page
    .getByRole('button', { name: /new game/i })
    .first()
    .click()
  await page.getByLabel('New game name').fill('The Long Haul')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(/\/games\//, { timeout: 20_000 })
  const game = routeOf(itun, new URL(page.url()).pathname)
  await page.goto(rootOf(itun), { waitUntil: 'networkidle' })
  const links = await page
    .evaluate(() =>
      [...(globalThis as unknown as InPage).document.querySelectorAll('a[href]')].map(
        (a) => a.getAttribute('href') ?? ''
      )
    )
    .then((hrefs) => hrefs.map((href) => routeOf(itun, href)))
  const find = (prefix: string) => links.find((l) => l.startsWith(prefix))
  const seeded: Partial<Seeded> = {
    pilot: find('/sheet/pilot/'),
    mech: find('/sheet/mech/'),
    crawler: find('/sheet/crawler/'),
    game,
  }
  await page.getByRole('button', { name: 'More for Bonesaw' }).click()
  await page.getByRole('menuitem', { name: 'Move to a Game…' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'The Long Haul' }).click()
  const confirm = page.getByRole('dialog').getByRole('button', { name: /^Move/ })
  if (await confirm.count()) await confirm.first().click()
  await settle(page, 2000)
  return seeded
}

/** One page to shoot: its file stem, its site's base and the URL it is shot from. */
export type GalleryTarget = { page: GalleryPage; slug: string; base: string; url: string }

/** The signed-out pages, each on its site's base; a page whose site was not given is left out. */
export function signedOutTargets(args: Pick<GalleryArgs, 'srd' | 'itun'>): GalleryTarget[] {
  return GALLERY_PAGES.filter((p) => !p.signedIn).flatMap((page) => {
    const base = page.site === 'srd' ? args.srd : args.itun
    return base ? [{ page, slug: pageSlug(page), base, url: `${base}${page.path}` }] : []
  })
}

/** The signed-in pages with the seed's placeholders resolved, and a failure for each the seed did not make. */
export function signedInTargets(
  itun: string,
  seeded: Partial<Seeded>
): { targets: GalleryTarget[]; failures: string[] } {
  const targets: GalleryTarget[] = []
  const failures: string[] = []
  for (const page of GALLERY_PAGES.filter((p) => p.signedIn)) {
    const path = resolvePath(page.path, seeded)
    if (path) targets.push({ page, slug: pageSlug(page), base: itun, url: `${itun}${path}` })
    else failures.push(`itun ${page.path}: the seed made no such entity`)
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
  const entity = page.site === 'srd' ? pageEntity(page.path) : undefined
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
        bases: { srd: args.srd, itun: args.itun },
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

async function run(args: GalleryArgs): Promise<number> {
  const shots = join(args.out, 'shots')
  mkdirSync(shots, { recursive: true })
  const shot = new Set<string>()
  const og = new Map<string, OgMeta>()
  const failures: string[] = []
  const file = (slug: string) => (view: string) => join(shots, `${slug}-${view}.jpg`)
  const browser: Browser = await launchBrowser()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    for (const t of signedOutTargets(args)) {
      try {
        await shootPage(page, t.url, file(t.slug), false)
        shot.add(t.slug)
        const meta = await readOg(page)
        const source = ogSource(t.page, t.base, meta.image)
        const ogFile = join(shots, `${t.slug}-og.png`)
        let image = false
        if (source?.kind === 'card') {
          await renderOgCard(context, args.srd, source.entity, ogFile)
          image = true
        } else if (source) image = await fetchOgImage(source.url, ogFile)
        og.set(t.slug, { title: meta.title, description: meta.description, image })
      } catch (error) {
        failures.push(failureLine(`${t.page.site} ${t.page.path}`, error))
      }
      process.stdout.write('.')
    }
    await context.close()

    if (args.signedIn && args.itun) {
      const signed = await browser.newContext()
      const sp = await signed.newPage()
      let seeded: Partial<Seeded> = {}
      try {
        seeded = await seed(sp, args.itun)
      } catch (error) {
        failures.push(failureLine('itun seed', error))
      }
      const planned = signedInTargets(args.itun, seeded)
      failures.push(...planned.failures)
      for (const t of planned.targets) {
        try {
          await shootPage(sp, t.url, file(t.slug), !!t.page.edit)
          shot.add(t.slug)
        } catch (error) {
          failures.push(failureLine(`itun ${t.page.path}`, error))
        }
        process.stdout.write('.')
      }
      await signed.close()
    }
  } finally {
    await browser.close()
  }
  return writeGallery(args, { shot, og, failures }, capturedAtStamp(new Date()))
}

if (import.meta.main) {
  let args: GalleryArgs
  try {
    args = parseGalleryArgs(process.argv.slice(2))
  } catch (error) {
    console.error((error as Error).message)
    process.exit(2)
  }
  process.exit(await run(args))
}
