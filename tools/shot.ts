#!/usr/bin/env bun
/**
 * shot — a headless screenshot of a story or an srd page, for an agent that
 * has no browser preview.
 *
 *   bun run shot <story-id|/route> [--width phone|column|page] [--dark] [--out <dir>]
 *
 * `.claude/launch.json`'s previews exist only in the Desktop app, so a cloud
 * agent restyling a component could not see what it changed (refit ledger
 * A8: the design-refresh audit hand-rolled a Playwright script for its
 * screenshots). This is that script, once.
 *
 * - A target starting with `/` is an srd route, served by `bun run dev` on
 *   4321. Anything else is a story id (`bun run stories:ids [filter]` lists
 *   them), served canvas-only by the story catalog (`bun run stories`) on
 *   61000. ITUN is reached through its stories only: its own dev server needs
 *   a local Convex backend.
 * - A server already answering on the port is reused; otherwise this starts
 *   one and stops it afterwards.
 * - `--width` is the catalog's preset (`WIDTH_PRESETS` in
 *   `packages/component-lib/src/stories/_catalogRoute.ts`): the viewport width,
 *   and for a story its container width too. The capture is the full page.
 * - `--dark` emulates `prefers-color-scheme: dark`.
 * - PNGs go to the gitignored `.shots/` (or `--out`); each path is printed for
 *   the agent to Read.
 * - The browser is the pinned Playwright's own Chromium, or
 *   `/opt/pw-browsers/chromium` (the cloud image's) when that is not
 *   installed; `SHOT_CHROME_PATH` overrides both.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dir, '..')

/** Mirrors `WIDTH_PRESETS` in component-lib's `_catalogRoute.ts`. */
export const WIDTHS = { phone: 375, column: 480, page: 1200 } as const
type Width = keyof typeof WIDTHS

const FALLBACK_CHROME = '/opt/pw-browsers/chromium'

export type ShotArgs = { target: string; width: Width; dark: boolean; out: string }

type Server = { name: string; port: number; script: string }
const SRD: Server = { name: 'srd', port: 4321, script: 'dev' }
const STORIES: Server = { name: 'stories', port: 61000, script: 'stories' }

const USAGE =
  'usage: bun run shot <story-id|/route> [--width phone|column|page] [--dark] [--out <dir>]'

const isWidth = (value: string): value is Width => Object.hasOwn(WIDTHS, value)

/** Parses argv (after the script). Throws with the usage line on a bad argument. */
export function parseArgs(argv: readonly string[]): ShotArgs {
  let target: string | undefined
  let width: Width = 'page'
  let dark = false
  let out = join(REPO, '.shots')
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    const [flag, inline] = arg.startsWith('--') ? arg.split('=', 2) : [arg, undefined]
    const value = () => inline ?? argv[++i] ?? ''
    if (flag === '--dark') dark = true
    else if (flag === '--width') {
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
  return { target, width, dark, out }
}

/** Which server answers for the target, and the path to load on it. */
export function planShot({ target, width }: Pick<ShotArgs, 'target' | 'width'>): {
  server: Server
  path: string
} {
  if (target.startsWith('/')) return { server: SRD, path: target }
  const params = new URLSearchParams({ story: target, mode: 'canvas', width })
  return { server: STORIES, path: `/?${params}` }
}

/** `<target>-<width>[-dark].png`, the target reduced to a safe file name. */
export function fileName({ target, width, dark }: Omit<ShotArgs, 'out'>): string {
  const slug =
    target
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'home'
  return `${slug}-${width}${dark ? '-dark' : ''}.png`
}

async function answers(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) })
    return true
  } catch {
    return false
  }
}

/** Reuses a server on the port, or starts one. Returns its stop function. */
async function ensureServer(server: Server): Promise<() => void> {
  if (await answers(server.port)) {
    console.error(`[shot] reusing the ${server.name} server on :${server.port}`)
    return () => {
      // Not ours to stop.
    }
  }
  console.error(`[shot] starting ${server.name} (bun run ${server.script}) on :${server.port}…`)
  const proc = Bun.spawn(['bun', 'run', server.script], {
    cwd: REPO,
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
    if (await answers(server.port)) return stop
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
  const list = Bun.spawnSync(['bun', 'packages/component-lib/listStories.ts'], { cwd: REPO })
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

async function launchBrowser() {
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
  const stop = await ensureServer(server)
  try {
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage({
        viewport: { width: WIDTHS[args.width], height: 800 },
        colorScheme: args.dark ? 'dark' : 'light',
      })
      const url = `http://localhost:${server.port}${path}`
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      if (response && !response.ok())
        console.error(`[shot] warning: ${url} answered ${response.status()}`)
      await page.evaluate('document.fonts.ready')
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
