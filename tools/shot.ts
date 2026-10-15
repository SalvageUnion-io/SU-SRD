#!/usr/bin/env bun
/**
 * shot — a headless screenshot of one of the site's pages, for an agent that has
 * no browser preview.
 *
 *   bun run shot </route|cantina:/route> [--width phone|column|page] [--out <dir>]
 *
 * `.claude/launch.json`'s previews exist only in the Desktop app, so a cloud
 * agent restyling a component could not see what it changed (a design audit
 * once hand-rolled a Playwright script for its screenshots). This is that
 * script, once.
 *
 * - A target starting with `/` is a path on the site. `cantina:/route` is a Cantina
 *   route (under its `/build` base, so `cantina:/starter` is `/build/starter`).
 *   One dev server answers both: a running `bun run dev`, or else the dev server
 *   alone (`ssg/dev.ts`, no `convex dev`) booted signed out with no backend:
 *   `VITE_CONVEX_URL` points at a closed local port, so the Cantina's pages that
 *   need no account (the front door, the Starter Set, a sign-in prompt) render,
 *   and anything that waits on Convex shows its loading or offline state.
 * - The server listens on this checkout's port (`packages/gates/lib/ports.ts`:
 *   4321 in the primary checkout, offset in a linked worktree). One
 *   already answering there is reused only when its `x-su-checkout` header
 *   names this checkout; a server from another checkout is refused, never
 *   screenshotted. With none answering, this starts one and stops it
 *   afterwards.
 * - `--width` is the viewport width (`WIDTHS`). The capture is the full page,
 *   scrolled through first so lazy images (`loading="lazy"` art) have loaded.
 * - There is no `--dark`: neither app has a dark theme, so the capture is
 *   always the paper one.
 * - PNGs go to the gitignored `.shots/` (or `--out`); each path is printed for
 *   the agent to Read.
 * - The browser is `launchBrowser`'s (`packages/gates/lib/chromium.ts`): the
 *   pinned Playwright's own Chromium, or `/opt/pw-browsers/chromium` (the
 *   cloud image's) when that is not installed; `SHOT_CHROME_PATH` overrides
 *   both.
 */

import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launchBrowser } from 'gates/lib/chromium'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'

const REPO = resolve(import.meta.dir, '..')

/** The viewport widths `--width` names. */
export const WIDTHS = { phone: 375, column: 480, page: 1200 } as const
type Width = keyof typeof WIDTHS

export type ShotArgs = { target: string; width: Width; out: string }

/** How to start a server: the command, where, and what it adds to the environment. */
export type Server = {
  name: string
  port: number
  cmd: readonly string[]
  cwd: string
  env?: Readonly<Record<string, string>>
}
/** The prefix that makes a target a Cantina route. */
const CANTINA_PREFIX = 'cantina:'

/** The Cantina's base path (`APP_BASE` in `apps/web/src/lib/appBase.ts`, ADR-048). */
export const CANTINA_BASE = '/build'

/**
 * Where the signed-out boot's Convex client points: a closed port on this
 * machine, so it fails fast and nothing leaves the machine. Any URL will do
 * (`vite.config.ts` refuses only a missing one); it beats a `.convex.cloud`
 * name, which would be looked up and might be someone's deployment.
 */
export const NO_BACKEND = 'http://127.0.0.1:9'

const DEV: Server = {
  name: 'dev',
  port: portFor(),
  // The dev server itself, not `bun run dev`, which starts a Convex backend.
  cmd: ['bun', 'ssg/dev.ts'],
  cwd: join(REPO, 'apps/web'),
  // Over any `apps/web/.env.local` a `bun run dev` run wrote: Vite lets the
  // environment win.
  env: { VITE_CONVEX_URL: NO_BACKEND },
}

const USAGE =
  'usage: bun run shot </route|cantina:/route> [--width phone|column|page] [--out <dir>]'

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
  if (target.startsWith(CANTINA_PREFIX) && !target.startsWith(`${CANTINA_PREFIX}/`))
    throw new Error(`a Cantina target is cantina:/route, not "${target}"\n${USAGE}`)
  if (!target.startsWith('/') && !target.startsWith(CANTINA_PREFIX))
    throw new Error(`a target is /route or cantina:/route, not "${target}"\n${USAGE}`)
  return { target, width, out }
}

/** Which server answers for the target, and the path to load on it. */
export function planShot({ target }: Pick<ShotArgs, 'target'>): {
  server: Server
  path: string
} {
  if (target.startsWith(CANTINA_PREFIX))
    return { server: DEV, path: CANTINA_BASE + target.slice(CANTINA_PREFIX.length) }
  return { server: DEV, path: target }
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
    // The dev server honours an explicit `PORT`, so pin the one probed
    // below over any `PORT` this shell inherited.
    env: { ...process.env, ...server.env, PORT: String(server.port) },
    stdout: 'ignore',
    stderr: 'pipe',
    detached: true,
  })
  const stop = () => {
    // Signal the whole group: the server and anything it spawned.
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
 * A full-page screenshot captures what is below the fold without scrolling
 * to it, so `loading="lazy"` art there never starts and comes out blank.
 * Scroll the page through a viewport at a time, then back to the top.
 */
const SCROLL_THROUGH = `(async () => {
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
const IMAGES_DECODED = `Promise.race([
  Promise.all(
    Array.from(document.images, (img) =>
      img.complete ? undefined : img.decode().catch(() => undefined)
    )
  ),
  new Promise((resolve) => setTimeout(resolve, 5000)),
])`

/** The servers and browser `main` uses, and what it prints through. */
export type ShotDeps = {
  ensure?: typeof ensureServer
  launch?: typeof launchBrowser
  log?: (line: string) => void
  error?: (line: string) => void
}

/** Take the screenshot `argv` asks for and print its path; returns the exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  {
    ensure = ensureServer,
    launch = launchBrowser,
    log = console.log,
    error = console.error,
  }: ShotDeps = {}
): Promise<number> {
  let args: ShotArgs
  try {
    args = parseArgs([...argv])
  } catch (caught) {
    error((caught as Error).message)
    return 2
  }
  const { server, path } = planShot(args)
  let stop: () => void
  try {
    stop = await ensure(server)
  } catch (caught) {
    error(`[shot] ${(caught as Error).message}`)
    return 2
  }
  try {
    const browser = await launch()
    try {
      const page = await browser.newPage({
        viewport: { width: WIDTHS[args.width], height: 800 },
      })
      const url = `http://localhost:${server.port}${path}`
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      if (response && !response.ok()) error(`[shot] warning: ${url} answered ${response.status()}`)
      await page.evaluate('document.fonts.ready')
      await page.evaluate(SCROLL_THROUGH)
      // What the scroll started loading, then a frame for it to paint.
      await page.waitForLoadState('networkidle', { timeout: 30_000 })
      await page.evaluate(IMAGES_DECODED)
      mkdirSync(args.out, { recursive: true })
      const file = join(args.out, fileName(args))
      await page.screenshot({ path: file, fullPage: true })
      log(file)
    } finally {
      await browser.close()
    }
  } finally {
    stop()
  }
  return 0
}

if (import.meta.main) process.exit(await main())
