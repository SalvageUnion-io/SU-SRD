#!/usr/bin/env bun
/**
 * shot — a headless screenshot of a story or an srd page, for an agent that
 * has no browser preview.
 *
 *   bun run shot <story-id|/route|itun:/route> [--width phone|column|page] [--out <dir>]
 *
 * `.claude/launch.json`'s previews exist only in the Desktop app, so a cloud
 * agent restyling a component could not see what it changed (a design audit
 * once hand-rolled a Playwright script for its screenshots). This is that
 * script, once.
 *
 * - A target starting with `/` is an srd route, served by `bun run dev`.
 *   `itun:/route` is an ITUN route (under its `/build` base, so `itun:/starter`
 *   is `/build/starter`), served by ITUN's Vite dev server booted signed out
 *   with no backend: `VITE_CONVEX_URL` points at a closed local port, so the
 *   pages that need no account (the front door, the Starter Set, a sign-in
 *   prompt) render, and anything that waits on Convex shows its loading or
 *   offline state. `bun run dev:itun` (a real local backend) is not reused.
 *   Anything else is a story id (`bun run stories:ids [filter]` lists them),
 *   served canvas-only by the story catalog (`bun run stories`).
 * - Each server listens on this checkout's port (`packages/gates/lib/ports.ts`:
 *   4321, 61000 and 5180 in the primary checkout, offset in a linked worktree). One
 *   already answering there is reused only when its `x-su-checkout` header
 *   names this checkout; a server from another checkout is refused, never
 *   screenshotted. With none answering, this starts one and stops it
 *   afterwards.
 * - `--width` is the catalog's preset (`WIDTH_PRESETS` in
 *   `apps/catalog/src/catalogRoute.ts`): the viewport width,
 *   and for a story its container width too. The capture is the full page,
 *   scrolled through first so lazy images (`loading="lazy"` art) have loaded.
 * - There is no `--dark`: neither app has a dark theme, so the capture is
 *   always the paper one.
 * - PNGs go to the gitignored `.shots/` (or `--out`); each path is printed for
 *   the agent to Read.
 * - The browser is the pinned Playwright's own Chromium, or
 *   `/opt/pw-browsers/chromium` (the cloud image's) when that is not
 *   installed; `SHOT_CHROME_PATH` overrides both.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'

const REPO = resolve(import.meta.dir, '..')

/** Mirrors `WIDTH_PRESETS` in the catalog's `catalogRoute.ts`. */
export const WIDTHS = { phone: 375, column: 480, page: 1200 } as const
type Width = keyof typeof WIDTHS

const FALLBACK_CHROME = '/opt/pw-browsers/chromium'

export type ShotArgs = { target: string; width: Width; out: string }

/** How to start a server: the command, where, and what it adds to the environment. */
export type Server = {
  name: string
  port: number
  cmd: readonly string[]
  cwd: string
  env?: Readonly<Record<string, string>>
}
const SRD: Server = { name: 'srd', port: portFor('srd'), cmd: ['bun', 'run', 'dev'], cwd: REPO }
const STORIES: Server = {
  name: 'stories',
  port: portFor('stories'),
  cmd: ['bun', 'run', 'stories'],
  cwd: REPO,
}

/** The prefix that makes a target an ITUN route. */
const ITUN_PREFIX = 'itun:'

/** ITUN's base path (`SITE.base` in `apps/itun/src/lib/site.ts`, ADR-048). */
export const ITUN_BASE = '/build'

/**
 * Where the signed-out boot's Convex client points: a closed port on this
 * machine, so it fails fast and nothing leaves the machine. Any URL will do
 * (`vite.config.ts` refuses only a missing one); it beats a `.convex.cloud`
 * name, which would be looked up and might be someone's deployment.
 */
export const NO_BACKEND = 'http://127.0.0.1:9'

const ITUN_PORT = portFor('itun')
const ITUN: Server = {
  name: 'itun',
  port: ITUN_PORT,
  // Vite itself, not `bun run dev:itun`, which starts a Convex backend. The
  // port goes on the command line: `vite.config.ts` leaves it at 5173 for
  // `dev:itun`.
  cmd: ['bun', 'x', 'vite', '--port', String(ITUN_PORT), '--strictPort'],
  cwd: join(REPO, 'apps/itun'),
  // Over any `apps/itun/.env.local` a `dev:itun` run wrote: Vite lets the
  // environment win.
  env: { VITE_CONVEX_URL: NO_BACKEND },
}

const USAGE =
  'usage: bun run shot <story-id|/route|itun:/route> [--width phone|column|page] [--out <dir>]'

const isWidth = (value: string): value is Width => Object.hasOwn(WIDTHS, value)

/** Parses argv (after the script). Throws with the usage line on a bad argument. */
export function parseArgs(argv: readonly string[]): ShotArgs {
  let target: string | undefined
  let width: Width = 'page'
  let out = join(REPO, '.shots')
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    const [flag, inline] = arg.startsWith('--') ? arg.split('=', 2) : [arg, undefined]
    const value = () => inline ?? argv[++i] ?? ''
    if (flag === '--width') {
      const w = value()
      if (!isWidth(w))
        throw new Error(`--width must be phone, column or page, not "${w}"\n${USAGE}`)
      width = w
    } else if (flag === '--out') {
      const dir = value()
      if (!dir) throw new Error(`--out needs a directory\n${USAGE}`)
      out = resolve(dir)
    } else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}\n${USAGE}`)
    else if (target === undefined) target = arg
    else throw new Error(`one target only, got "${target}" and "${arg}"\n${USAGE}`)
  }
  if (!target) throw new Error(USAGE)
  if (target.startsWith(ITUN_PREFIX) && !target.startsWith(`${ITUN_PREFIX}/`))
    throw new Error(`an ITUN target is itun:/route, not "${target}"\n${USAGE}`)
  return { target, width, out }
}

/** Which server answers for the target, and the path to load on it. */
export function planShot({ target, width }: Pick<ShotArgs, 'target' | 'width'>): {
  server: Server
  path: string
} {
  if (target.startsWith('/')) return { server: SRD, path: target }
  if (target.startsWith(ITUN_PREFIX))
    return { server: ITUN, path: ITUN_BASE + target.slice(ITUN_PREFIX.length) }
  const params = new URLSearchParams({ story: target, mode: 'canvas', width })
  return { server: STORIES, path: `/?${params}` }
}

/** `<target>-<width>.png`, the target reduced to a safe file name. */
export function fileName({ target, width }: Omit<ShotArgs, 'out'>): string {
  const slug =
    target
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'home'
  return `${slug}-${width}.png`
}

/**
 * What answers on the port: `undefined` for nothing, else the checkout its
 * `x-su-checkout` header names (`null` when it names none).
 */
export async function probe(port: number): Promise<string | null | undefined> {
  try {
    const response = await fetch(`http://localhost:${port}/`, {
      signal: AbortSignal.timeout(2000),
    })
    await response.body?.cancel()
    return response.headers.get(CHECKOUT_HEADER)
  } catch {
    return undefined
  }
}

/**
 * Whether a server whose header names `checkout` may be reused by this
 * checkout. Anything else (another checkout's server, or one that names none)
 * would capture code this checkout does not have.
 */
export function isOwnServer(checkout: string | null | undefined, root = CHECKOUT_ROOT): boolean {
  return checkout === root
}

/** Reuses this checkout's server on the port, or starts one. Returns its stop function. */
export async function ensureServer(server: Server): Promise<() => void> {
  const found = await probe(server.port)
  if (found !== undefined) {
    if (!isOwnServer(found))
      throw new Error(
        `:${server.port} is answered by ${found ? `the ${server.name} server of ${found}` : 'a server that does not name its checkout'}, not this checkout (${CHECKOUT_ROOT}). Stop it, then rerun.`
      )
    console.error(`[shot] reusing the ${server.name} server on :${server.port}`)
    return () => {
      // Not ours to stop.
    }
  }
  console.error(`[shot] starting ${server.name} (${server.cmd.join(' ')}) on :${server.port}…`)
  const proc = Bun.spawn([...server.cmd], {
    cwd: server.cwd,
    // srd and the catalog honour an explicit `PORT`, so pin the one probed
    // below over any `PORT` this shell inherited.
    env: { ...process.env, ...server.env, PORT: String(server.port) },
    stdout: 'ignore',
    stderr: 'pipe',
    detached: true,
  })
  const stop = () => {
    // `bun run` → `bun --filter` → the server: signal the whole group.
    try {
      process.kill(-proc.pid, 'SIGTERM')
    } catch {
      proc.kill()
    }
  }
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      const err = await new Response(proc.stderr).text()
      throw new Error(`${server.name} exited (${proc.exitCode}) before answering:\n${err}`)
    }
    if (isOwnServer(await probe(server.port))) return stop
    await Bun.sleep(500)
  }
  stop()
  throw new Error(`${server.name} did not answer on :${server.port} within 90s`)
}

/**
 * The catalog shows its default story for an id it does not know, so a typo
 * would capture the wrong thing silently: check the id against the catalog's
 * own listing first.
 */
async function assertStory(id: string) {
  const list = Bun.spawnSync(['bun', 'apps/catalog/listStories.ts'], { cwd: REPO })
  const ids = list.stdout
    .toString()
    .split('\n')
    .map((line) => line.split('\t')[0])
  if (ids.includes(id)) return
  const near = ids.filter((known) => known?.includes(id.split('--').at(-1) ?? id)).slice(0, 10)
  console.error(
    `[shot] no story "${id}". ${near.length ? `Did you mean:\n  ${near.join('\n  ')}` : 'List them: bun run stories:ids [filter]'}`
  )
  process.exit(2)
}

/**
 * A full-page screenshot captures what is below the fold without scrolling
 * to it, so `loading="lazy"` art there never starts and comes out blank.
 * Scroll the page through a viewport at a time, then back to the top.
 */
export const SCROLL_THROUGH = `(async () => {
  const step = Math.max(200, Math.floor(window.innerHeight * 0.8))
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  window.scrollTo(0, 0)
})()`

/**
 * Waits for every image on the page to finish loading (or failing) and
 * decode, for at most five seconds: one that never starts must not hang it.
 */
export const IMAGES_DECODED = `Promise.race([
  Promise.all(
    Array.from(document.images, (img) =>
      img.complete ? undefined : img.decode().catch(() => undefined)
    )
  ),
  new Promise((resolve) => setTimeout(resolve, 5000)),
])`

/** The pinned Playwright's Chromium, the cloud image's, or `SHOT_CHROME_PATH` (also `tools/gallery.ts`'s). */
export async function launchBrowser() {
  const { chromium } = await import('@playwright/test')
  const own = chromium.executablePath()
  const executablePath =
    process.env.SHOT_CHROME_PATH ||
    (existsSync(own) ? undefined : existsSync(FALLBACK_CHROME) ? FALLBACK_CHROME : undefined)
  return chromium.launch({ executablePath })
}

async function main() {
  let args: ShotArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error((error as Error).message)
    process.exit(2)
  }
  const { server, path } = planShot(args)
  if (server === STORIES) await assertStory(args.target)
  let stop: () => void
  try {
    stop = await ensureServer(server)
  } catch (error) {
    console.error(`[shot] ${(error as Error).message}`)
    process.exit(2)
  }
  try {
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage({
        viewport: { width: WIDTHS[args.width], height: 800 },
      })
      const url = `http://localhost:${server.port}${path}`
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      if (response && !response.ok())
        console.error(`[shot] warning: ${url} answered ${response.status()}`)
      await page.evaluate('document.fonts.ready')
      await page.evaluate(SCROLL_THROUGH)
      // What the scroll started loading, then a frame for it to paint.
      await page.waitForLoadState('networkidle', { timeout: 30_000 })
      await page.evaluate(IMAGES_DECODED)
      mkdirSync(args.out, { recursive: true })
      const file = join(args.out, fileName(args))
      await page.screenshot({ path: file, fullPage: true })
      console.log(file)
    } finally {
      await browser.close()
    }
  } finally {
    stop()
  }
}

if (import.meta.main) await main()
