#!/usr/bin/env bun
/**
 * dev-backend — the whole site with the test sign-in and a seeded account,
 * for an agent session that must see the app signed in (Play, a Game, the
 * sheets).
 *
 *   bun run dev:backend [--fresh]
 *
 * - It runs the dev server (`astro dev`, which runs the site Worker under
 *   `wrangler dev` beside it: `apps/web/astro/build/devRooms.ts`) with the
 *   test seam on, on this checkout's port (`packages/gates/lib/ports.ts`,
 *   4321 in the primary checkout).
 * - State lives in `.dev-backend/` at the checkout root (gitignored): the
 *   Worker's rooms and shared database (`wrangler dev --persist-to`) and
 *   `seed.json`. A restart keeps it; `--fresh` wipes it first.
 * - The first start seeds `SEED_ACCOUNT` through the test seam with the one
 *   account seed (`packages/gates/lib/seedAccount.ts`, by way of
 *   `tools/gallery.ts`'s `seed`: what the layout gates' e2e walk signs in to)
 *   and writes the account and every page it made (`SEED_KEYS`) to
 *   `.dev-backend/seed.json`.
 *   Where no browser starts (a Remote Control sandbox refuses the full
 *   Chromium's socket), it installs Playwright's chrome-headless-shell into
 *   `.pw-browsers/` first. A seed that still fails is reported and the site
 *   runs on, signed out.
 * - It stays in the foreground until interrupted, then stops the server. Run
 *   it in the background; a second run while the server answers exits 0 at
 *   once.
 *
 * `bun run shot <target> --signed-in` (`tools/shot.ts`) signs in as the seeded
 * account on that dev server; a `:key` (`:pilot`, `:game`, `:playMediator`, …)
 * names a seeded page.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser, Page } from '@playwright/test'
import { FORCE_ONLINE, headlessShell, launchBrowser } from 'gates/lib/chromium'
import type { Seed } from 'gates/lib/seedAccount'
import type { SeamAccount } from 'gates/lib/testSignIn'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
import { appRoot, seed } from './gallery'

/** Where the dev server keeps its state, under the checkout root. */
export const STATE_DIR = '.dev-backend'

/** The account the seed makes and `bun run shot --signed-in` signs in as. Local only. */
export const SEED_ACCOUNT: SeamAccount = {
  email: 'agent@example.com',
  password: 'agent-dev-pass-1',
}

/** What `seed.json` holds: the account, and the seeded pages' app paths. */
export type SeedFile = SeamAccount & Partial<Seed>

const USAGE = 'usage: bun run dev:backend [--fresh]'

/** Parses argv (after the script). Throws with the usage line on a bad argument. */
export function parseArgs(argv: readonly string[]): { fresh: boolean } {
  let fresh = false
  for (const arg of argv) {
    if (arg === '--fresh') fresh = true
    else throw new Error(`unknown argument ${arg}\n${USAGE}`)
  }
  return { fresh }
}

/** What a command printed and how it exited. */
export type RunResult = { code: number; stdout: string; stderr: string }

/** A process left running: its exit, and how to stop it. */
type Child = { exited: Promise<number>; stop: () => void }

/** The machine, injected so the tests run none of it. */
export type Sys = {
  /** Runs a command to completion. */
  run: (cmd: readonly string[], cwd: string, env?: Record<string, string>) => Promise<RunResult>
  /** Starts a long-running process, its output appended to `logFile`. */
  spawn: (
    cmd: readonly string[],
    cwd: string,
    logFile: string,
    env?: Record<string, string>
  ) => Child
  /** The `x-su-checkout` header at `url` (`null` if none), or `undefined` when nothing answers. */
  probe: (url: string) => Promise<string | null | undefined>
  sleep: (ms: number) => Promise<void>
  /** Resolves when the process is asked to stop (SIGINT, SIGTERM). */
  interrupted: () => Promise<void>
  launch: () => Promise<Browser>
  /** Signs the account up and seeds it (`tools/gallery.ts`'s `seed`). */
  seed: (page: Page, base: string, account: SeamAccount) => Promise<Partial<Seed>>
  log: (line: string) => void
  error: (line: string) => void
}

/** The real machine. */
export const realSys: Sys = {
  async run(cmd, cwd, env) {
    const proc = Bun.spawn([...cmd], {
      cwd,
      env: { ...process.env, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { code, stdout, stderr }
  },
  spawn(cmd, cwd, logFile, env) {
    const log = Bun.file(logFile)
    const proc = Bun.spawn([...cmd], {
      cwd,
      env: { ...process.env, ...env },
      stdout: log,
      stderr: log,
      detached: true,
    })
    return {
      exited: proc.exited,
      stop: () => {
        // The whole group: Vite, and the Worker under it.
        try {
          process.kill(-proc.pid, 'SIGTERM')
        } catch {
          proc.kill()
        }
      },
    }
  },
  async probe(url) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      await response.body?.cancel()
      return response.headers.get(CHECKOUT_HEADER)
    } catch {
      return undefined
    }
  },
  sleep: (ms) => Bun.sleep(ms),
  interrupted: () =>
    new Promise((resolve) => {
      process.once('SIGINT', () => resolve())
      process.once('SIGTERM', () => resolve())
    }),
  launch: () => launchBrowser(),
  seed,
  log: (line) => console.log(line),
  error: (line) => console.error(line),
}

/** Polls until `url` answers, for at most `seconds`. */
async function waitFor(sys: Sys, url: string, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds * 2; i++) {
    if ((await sys.probe(url)) !== undefined) return true
    await sys.sleep(500)
  }
  return false
}

/**
 * A browser. When none starts and the checkout has no headless shell yet,
 * installs Playwright's into `.pw-browsers/` (`gates/lib/chromium`'s
 * `CHECKOUT_BROWSERS`) and tries once more: the full Chromium opens a unix
 * socket a Remote Control sandbox refuses; the headless shell does not.
 */
async function launchOrInstall(sys: Sys, root: string): Promise<Browser> {
  const failed = (caught: Error) =>
    new Error(`Chromium could not start: ${caught.message.split('\n')[0]}`)
  try {
    return await sys.launch()
  } catch (caught) {
    const browsers = join(root, '.pw-browsers')
    if (headlessShell(browsers)) throw failed(caught as Error)
    sys.log(`[dev-backend] no browser starts; installing chrome-headless-shell to ${browsers}…`)
    const install = await sys.run(
      ['bunx', 'playwright', 'install', 'chromium-headless-shell'],
      root,
      { PLAYWRIGHT_BROWSERS_PATH: browsers }
    )
    if (install.code !== 0)
      throw new Error(`installing chrome-headless-shell failed: ${install.stderr.trim()}`)
    return await sys.launch().catch((again: Error) => {
      throw failed(again)
    })
  }
}

/** Signs `SEED_ACCOUNT` up, seeds it, and writes `seed.json`. A failure is reported, not thrown. */
async function seedOnce(sys: Sys, root: string, base: string, seedFile: string): Promise<void> {
  sys.log(`[dev-backend] seeding ${SEED_ACCOUNT.email}…`)
  try {
    const browser = await launchOrInstall(sys, root)
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      await page.addInitScript(FORCE_ONLINE)
      const seeded = await sys.seed(page, base, SEED_ACCOUNT)
      const file: SeedFile = { ...SEED_ACCOUNT, ...seeded }
      writeFileSync(seedFile, `${JSON.stringify(file, null, 2)}\n`)
      sys.log(`[dev-backend] seeded: ${JSON.stringify(seeded)}`)
    } finally {
      await browser.close()
    }
  } catch (caught) {
    sys.error(
      `[dev-backend] warning: the seed failed, so nothing is signed in (${(caught as Error).message.split('\n')[0]}). Rerun with --fresh to try again.`
    )
  }
}

/** Starts (or finds) the dev server, seeds once, and waits. Returns the exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  sys: Sys = realSys,
  { root = CHECKOUT_ROOT }: { root?: string } = {}
): Promise<number> {
  let fresh: boolean
  try {
    ;({ fresh } = parseArgs(argv))
  } catch (caught) {
    sys.error((caught as Error).message)
    return 2
  }
  const devPort = portFor({ root, ci: false })
  const base = `http://localhost:${devPort}`
  const devFound = await sys.probe(`${base}/`)
  if (devFound === root) {
    sys.log(`[dev-backend] already running: ${base}/build/`)
    return 0
  }
  if (devFound !== undefined) {
    sys.error(`[dev-backend] :${devPort} is already taken by another server. Stop it, then rerun.`)
    return 1
  }

  const state = join(root, STATE_DIR)
  if (fresh) rmSync(state, { recursive: true, force: true })
  mkdirSync(state, { recursive: true })
  const server = sys.spawn(
    ['bun', '--bun', 'astro', 'dev', '--ignore-lock'],
    join(root, 'apps/web'),
    join(state, 'dev.log'),
    { PORT: String(devPort), VITE_TEST_AUTH: 'true', DEV_ROOMS_STATE: join(state, 'wrangler') }
  )
  try {
    // The first request renders a page server-side through a cold Vite.
    if (!(await waitFor(sys, `${base}/`, 120)))
      throw new Error(`the dev server did not answer within 120s: see ${join(state, 'dev.log')}`)

    const seedFile = join(state, 'seed.json')
    if (!existsSync(seedFile)) await seedOnce(sys, root, base, seedFile)
    sys.log(
      [
        `[dev-backend] ready: ${appRoot(base)}`,
        `  sign in: __appTestSignIn('${SEED_ACCOUNT.email}', '${SEED_ACCOUNT.password}', 'signIn')`,
        `  shoot:   bun run shot :pilot --signed-in   (seeded pages: ${join(STATE_DIR, 'seed.json')})`,
        `  log:     ${join(STATE_DIR, 'dev.log')}`,
      ].join('\n')
    )
    const which = await Promise.race([
      sys.interrupted().then(() => 'interrupted' as const),
      server.exited.then(() => 'exited' as const),
    ])
    if (which === 'exited') {
      sys.error(`[dev-backend] the dev server exited: see ${join(STATE_DIR, 'dev.log')}`)
      return 1
    }
    return 0
  } catch (caught) {
    sys.error(`[dev-backend] ${(caught as Error).message}`)
    return 1
  } finally {
    server.stop()
  }
}

if (import.meta.main) process.exit(await main())
