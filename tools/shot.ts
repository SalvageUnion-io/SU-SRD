#!/usr/bin/env bun
/**
 * shot — a headless screenshot of one of the site's pages, for an agent that has
 * no browser preview.
 *
 *   bun run shot </route|app:/route|:seeded> [--width phone|column|page] [--out <dir>]
 *                [--signed-in]
 *
 * `.claude/launch.json`'s previews exist only in the Desktop app, so a cloud
 * agent restyling a component could not see what it changed (a design audit
 * once hand-rolled a Playwright script for its screenshots). This is that
 * script, once.
 *
 * - A target starting with `/` is a path on the site. `app:/route` is an app
 *   route (under its `/build` base, so `app:/starter` is `/build/starter`).
 *   One dev server answers both: a running `bun run dev`, or else the dev server
 *   (`astro dev`, which runs the Worker beside it) booted signed out, so the
 *   app's pages that need no account (the front door, the Starter Set, a
 *   sign-in prompt) render as a visitor sees them.
 * - The server listens on this checkout's port (`packages/gates/lib/ports.ts`:
 *   4321 in the primary checkout, offset in a linked worktree). One
 *   already answering there is reused only when its `x-su-checkout` header
 *   names this checkout; a server from another checkout is refused, never
 *   screenshotted. With none answering, this starts one and stops it
 *   afterwards.
 * - `--width` is the viewport width (`WIDTHS`): `phone` and `page` are the
 *   layout gates' widths (`DESIGN_VIEWPORTS`, 390 and 1440), so a shot shows
 *   what a gate measured; `column` (480) is shot's own. The capture is the full
 *   page, scrolled through first so lazy images (`loading="lazy"` art) have
 *   loaded.
 * - There is no `--dark`: neither app has a dark theme, so the capture is
 *   always the paper one.
 * - `--signed-in` signs in (`gates/lib/testSignIn.ts`) as the account
 *   `bun run dev:backend` (`tools/dev-backend.ts`) seeded, on the dev server
 *   that command runs (it is never started here: a signed-out boot has no
 *   backend). A `:key` target is a seeded page, from `.dev-backend/seed.json`:
 *   every key the seed makes (`SEED_KEYS`, `gates/lib/seedAccount.ts`:
 *   `:pilot`, `:mech`, `:crawler`, `:npc`, `:game`, `:invite`, `:playPlayer`,
 *   `:playSolo`, `:playMediator`), and `:play` and `:mediate` for the Play
 *   player's and Mediator's screens.
 * - PNGs go to the gitignored `.shots/` (or `--out`); each path is printed for
 *   the agent to Read.
 * - The browser is `launchBrowser`'s (`packages/gates/lib/chromium.ts`): the
 *   pinned Playwright's own Chromium, or `/opt/pw-browsers/chromium` (the
 *   cloud image's) when that is not installed; `SHOT_CHROME_PATH` overrides
 *   both.
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { FORCE_ONLINE, launchBrowser } from 'gates/lib/chromium'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import type { SeedKey } from 'gates/lib/seedAccount'
import { SEED_KEYS } from 'gates/lib/seedAccount'
import { signInThroughSeam } from 'gates/lib/testSignIn'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
import { APP_BASE } from '../apps/web/src/lib/appBase'
import type { SeedFile } from './dev-backend'
import { STATE_DIR } from './dev-backend'

const REPO = resolve(import.meta.dir, '..')

/** The viewport widths `--width` names: the gates' `phone` and `page`, and a column. */
export const WIDTHS = {
  phone: DESIGN_VIEWPORTS.phone.width,
  column: 480,
  page: DESIGN_VIEWPORTS.page.width,
} as const
type Width = keyof typeof WIDTHS

export type ShotArgs = { target: string; width: Width; out: string; signedIn: boolean }

/** How to start a server: the command, where, and what it adds to the environment. */
export type Server = {
  name: string
  port: number
  cmd: readonly string[]
  cwd: string
  env?: Readonly<Record<string, string>>
}
/** The prefix that makes a target an app route. */
const APP_PREFIX = 'app:'

/** The app's base path (ADR-048), from its one home; re-exported for the tests. */
export { APP_BASE }

const DEV: Server = {
  name: 'dev',
  port: portFor(),
  // The dev server itself, not `bun run dev`, which turns the test sign-in on.
  // `--ignore-lock`: in the foreground, where Astro would background itself for an agent.
  cmd: ['bun', '--bun', 'astro', 'dev', '--ignore-lock'],
  cwd: join(REPO, 'apps/web'),
}

const USAGE =
  'usage: bun run shot </route|app:/route|:seeded> [--width phone|column|page] [--out <dir>] [--signed-in]'

/** Short names for two seeded Play screens. */
const ALIASES: Readonly<Record<string, SeedKey>> = {
  play: 'playPlayer',
  mediate: 'playMediator',
}

/** The seed key a `:name` target names, or undefined when it names none. */
function seedKeyOf(target: string): SeedKey | undefined {
  if (!target.startsWith(':')) return undefined
  const name = target.slice(1)
  return ALIASES[name] ?? SEED_KEYS.find((key) => key === name)
}

/** Every `:name` target, for the usage line. */
const SEEDED = [...SEED_KEYS, ...Object.keys(ALIASES)].map((key) => `:${key}`)

const isWidth = (value: string): value is Width => Object.hasOwn(WIDTHS, value)

/** Parses argv (after the script). Throws with the usage line on a bad argument. */
export function parseArgs(argv: readonly string[]): ShotArgs {
  let target: string | undefined
  let width: Width = 'page'
  let out = join(REPO, '.shots')
  let signedIn = false
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
    } else if (flag === '--signed-in') signedIn = true
    else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}\n${USAGE}`)
    else if (target === undefined) target = arg
    else throw new Error(`one target only, got "${target}" and "${arg}"\n${USAGE}`)
  }
  if (!target) throw new Error(USAGE)
  if (target.startsWith(APP_PREFIX) && !target.startsWith(`${APP_PREFIX}/`))
    throw new Error(`an app target is app:/route, not "${target}"\n${USAGE}`)
  if (seedKeyOf(target)) {
    if (!signedIn) throw new Error(`${target} is a seeded page: add --signed-in\n${USAGE}`)
  } else if (!target.startsWith('/') && !target.startsWith(APP_PREFIX))
    throw new Error(
      `a target is /route, app:/route or ${SEEDED.join('|')}, not "${target}"\n${USAGE}`
    )
  return { target, width, out, signedIn }
}

/** Which server answers for the target, and the path to load on it. */
export function planShot(
  { target }: Pick<ShotArgs, 'target'>,
  seeded?: SeedFile
): {
  server: Server
  path: string
} {
  const key = seedKeyOf(target)
  if (key) {
    const path = seeded?.[key]
    if (!path) throw new Error(`the seed made no ${key}: rerun bun run dev:backend --fresh`)
    return { server: DEV, path }
  }
  if (target.startsWith(APP_PREFIX))
    return { server: DEV, path: APP_BASE + target.slice(APP_PREFIX.length) }
  return { server: DEV, path: target }
}

/** `<target>-<width>.png`, the target reduced to a safe file name. */
export function fileName({ target, width }: Pick<ShotArgs, 'target' | 'width'>): string {
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
  // A server with no command is only ever reused (`--signed-in`'s).
  if (!server.cmd.length)
    throw new Error(
      `nothing answers on :${server.port}: start it with \`bun run ${server.name}\`, then rerun`
    )
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

/** `.dev-backend/seed.json`, or an error saying how to make it. */
export function readSeedFile(root = CHECKOUT_ROOT): SeedFile {
  try {
    return JSON.parse(readFileSync(join(root, STATE_DIR, 'seed.json'), 'utf8')) as SeedFile
  } catch {
    throw new Error('no seeded account: run `bun run dev:backend` first (tools/dev-backend.ts)')
  }
}

/** The servers and browser `main` uses, and what it prints through. */
export type ShotDeps = {
  ensure?: typeof ensureServer
  /** The seed `bun run dev:backend` wrote; throws when there is none. */
  readSeed?: () => SeedFile
  launch?: typeof launchBrowser
  log?: (line: string) => void
  error?: (line: string) => void
}

/** Take the screenshot `argv` asks for and print its path; returns the exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  {
    ensure = ensureServer,
    readSeed = readSeedFile,
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
  let seeded: SeedFile | undefined
  let server: Server
  let path: string
  let stop: () => void
  try {
    if (args.signedIn) seeded = readSeed()
    ;({ server, path } = planShot(args, seeded))
    // Signed in, only the server `dev:backend` runs will do: a signed-out boot
    // has no backend to sign in to.
    stop = await ensure(seeded ? { ...server, name: 'dev:backend', cmd: [] } : server)
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
      // A sandbox's Chromium reports itself offline, and the app then waits on nothing.
      await page.addInitScript(FORCE_ONLINE)
      if (seeded) {
        await page.goto(`http://localhost:${server.port}${APP_BASE}/`, {
          waitUntil: 'networkidle',
          timeout: 60_000,
        })
        await signInThroughSeam(page, seeded, { flow: 'signIn' })
      }
      const url = `http://localhost:${server.port}${path}`
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      if (response && !response.ok()) error(`[shot] warning: ${url} answered ${response.status()}`)
      // The rooms answer over their sockets, which `networkidle` does not wait for.
      if (seeded) await page.waitForTimeout(1500)
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
