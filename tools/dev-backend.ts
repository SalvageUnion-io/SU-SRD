#!/usr/bin/env bun
/**
 * dev-backend — the whole site on a local Convex backend, with the test
 * sign-in and a seeded account, for an agent session that must see the app
 * signed in (Play, a Game, the sheets) and has no Convex account.
 *
 *   bun run dev:backend [--fresh]
 *
 * `bun run dev` runs `convex dev`, which needs a Convex login or an
 * interactive "run locally" choice; a cloud container or a Remote Control
 * sandbox has neither. This runs the self-hosted backend CI runs
 * (`.github/actions/convex-backend`), which needs no account:
 *
 * - The binary is the `convex-local-backend` release CI pins, its version and
 *   sha256 read from that action, so the two never drift. It is cached where
 *   `convex dev --local` caches binaries (`~/.cache/convex/binaries/<version>/`),
 *   or in `.dev-backend/binaries/` when the home is read-only (a Remote Control
 *   sandbox); when GitHub is unreachable, the newest binary already cached
 *   runs instead, with a warning.
 * - State lives in `.dev-backend/` at the checkout root (gitignored): the
 *   database, file storage, the instance secret, the sign-in's key and
 *   accounts (`auth-key.json`, `auth.sqlite`) and `seed.json`. A restart
 *   keeps it; `--fresh` wipes it first.
 * - The backend listens on 3310/3311 plus this checkout's port offset
 *   (`packages/gates/lib/ports.ts`), clear of `convex dev --local`'s 3210;
 *   the dev server on the checkout's own port (4321 in the primary checkout).
 * - Every start sets the deployment's auth env (`AUTH_JWKS`, the public half
 *   of the dev server's sign-in key, made once in the state directory, and
 *   `TEST_AUTH`) and pushes `apps/web/convex/`, through
 *   an env file of its own, so an `apps/web/.env.local` naming another
 *   deployment is never read. It does not watch: rerun to push a backend edit.
 *   The dev server (`astro dev`) reloads the site's code as usual.
 * - The first start seeds `SEED_ACCOUNT` through the test seam with the one
 *   account seed (`packages/gates/lib/seedAccount.ts`, by way of
 *   `tools/gallery.ts`'s `seed`: what the layout gates' e2e walk signs in to)
 *   and writes the account and every page it made (`SEED_KEYS`) to
 *   `.dev-backend/seed.json`.
 *   Where no browser starts (a Remote Control sandbox refuses the full
 *   Chromium's socket), it installs Playwright's chrome-headless-shell into
 *   `.pw-browsers/` first. A seed that still fails is reported and the site
 *   runs on, signed out.
 * - It stays in the foreground until interrupted, then stops both. Run it in
 *   the background; a second run while both answer exits 0 at once.
 *
 * `bun run shot <target> --signed-in` (`tools/shot.ts`) signs in as the seeded
 * account on that dev server; a `:key` (`:pilot`, `:game`, `:playMediator`, …)
 * names a seeded page.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Browser, Page } from '@playwright/test'
import { FORCE_ONLINE, headlessShell, launchBrowser } from 'gates/lib/chromium'
import type { Seed } from 'gates/lib/seedAccount'
import type { SeamAccount } from 'gates/lib/testSignIn'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, isPrimaryCheckout, portFor, portOffset } from 'gates/ports'
import { jwksDataUri, keyIn } from '../apps/web/scripts/authKeys'
import { appRoot, seed } from './gallery'

/** Where the backend keeps its state, under the checkout root. */
export const STATE_DIR = '.dev-backend'

/** The sign-in's private key (`apps/web/scripts/authKeys.ts`), in the state directory. */
const AUTH_KEY_FILE = 'auth-key.json'

/** The account the seed makes and `bun run shot --signed-in` signs in as. Local only. */
export const SEED_ACCOUNT: SeamAccount = {
  email: 'agent@example.com',
  password: 'agent-dev-pass-1',
}

/** What `seed.json` holds: the account, and the seeded pages' app paths. */
export type SeedFile = SeamAccount & Partial<Seed>

/** The backend's API port before this checkout's offset; its HTTP-actions port is the next. */
const BASE_BACKEND_PORT = 3310

const INSTANCE = 'dev-backend'

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

/** The pinned release (`CONVEX_BACKEND_VERSION`, `CONVEX_BACKEND_SHA256`) from CI's action. */
export function backendPins(actionYml: string): { version: string; sha256: string } {
  const version = actionYml.match(/CONVEX_BACKEND_VERSION:\s*(\S+)/)?.[1]
  const sha256 = actionYml.match(/CONVEX_BACKEND_SHA256:\s*([0-9a-f]{64})\b/)?.[1]
  if (!version || !sha256)
    throw new Error('.github/actions/convex-backend/action.yml names no pinned backend')
  return { version, sha256 }
}

/** The release asset's URL for `version` on this machine's platform. */
export function backendUrl(version: string, arch = process.arch, platform = process.platform) {
  const triple =
    platform === 'darwin'
      ? `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin`
      : `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux-gnu`
  return `https://github.com/get-convex/convex-backend/releases/download/${version}/convex-local-backend-${triple}.zip`
}

/** Where `convex dev --local` caches backend binaries, one directory per version. */
export const binariesDir = (home = homedir()) => join(home, '.cache', 'convex', 'binaries')

/** This checkout's backend ports: API and HTTP actions. */
export function backendPorts(root = CHECKOUT_ROOT): { api: number; site: number } {
  const api = BASE_BACKEND_PORT + 2 * portOffset(root, isPrimaryCheckout(root))
  return { api, site: api + 1 }
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
  /** Downloads `url` to `file`; throws when it cannot. */
  download: (url: string, file: string) => Promise<void>
  /** The sha256 of `file`, hex. */
  sha256: (file: string) => Promise<string>
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
        // The whole group: the dev server's Vite, the backend's workers.
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
  async download(url, file) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url} answered ${response.status}`)
    await Bun.write(file, response)
  },
  async sha256(file) {
    return new Bun.CryptoHasher('sha256').update(await Bun.file(file).arrayBuffer()).digest('hex')
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

/** The first of `dirs` a directory can be made in, or undefined. */
function writableDir(dirs: readonly string[], version: string): string | undefined {
  for (const dir of dirs) {
    try {
      mkdirSync(join(dir, version), { recursive: true })
      return join(dir, version)
    } catch {
      // Read-only (a Remote Control sandbox's home): try the next.
    }
  }
  return undefined
}

/**
 * The backend binary: the pinned one, cached in any of `dirs` or downloaded
 * and checked into the first writable one, else the newest one already
 * cached. Throws when there is none.
 */
export async function resolveBinary(
  sys: Sys,
  pins: { version: string; sha256: string },
  dirs: readonly string[]
): Promise<string> {
  const cachedIn = (version: string) =>
    dirs.map((d) => join(d, version, 'convex-local-backend')).find((binary) => existsSync(binary))
  const pinned = cachedIn(pins.version)
  if (pinned) return pinned
  const dir = writableDir(dirs, pins.version)
  try {
    if (!dir) throw new Error(`none of ${dirs.join(', ')} is writable`)
    const binary = join(dir, 'convex-local-backend')
    const zip = join(dir, 'backend.zip')
    sys.log(`[dev-backend] downloading convex-local-backend ${pins.version} to ${dir}…`)
    await sys.download(backendUrl(pins.version), zip)
    const sum = await sys.sha256(zip)
    if (sum !== pins.sha256) throw new Error(`checksum ${sum} is not the pinned ${pins.sha256}`)
    const unzip = await sys.run(['unzip', '-oq', zip, '-d', dir], dir)
    rmSync(zip, { force: true })
    if (unzip.code !== 0) throw new Error(`unzip failed: ${unzip.stderr.trim()}`)
    await sys.run(['chmod', '+x', binary], dir)
    return binary
  } catch (caught) {
    if (dir) rmSync(dir, { recursive: true, force: true })
    const versions = dirs
      .filter((d) => existsSync(d))
      .flatMap((d) => readdirSync(d))
      .filter((v) => cachedIn(v))
      .sort()
      .reverse()
    const fallback = versions[0]
    if (!fallback)
      throw new Error(
        `no convex-local-backend: the download failed (${(caught as Error).message}) and ${dirs.join(', ')} hold none`
      )
    sys.error(
      `[dev-backend] warning: the download failed (${(caught as Error).message}); running the cached ${fallback} instead of the pinned ${pins.version}`
    )
    return cachedIn(fallback) as string
  }
}

/** Polls until `url` answers, for at most `seconds`. */
async function waitFor(sys: Sys, url: string, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds * 2; i++) {
    if ((await sys.probe(url)) !== undefined) return true
    await sys.sleep(500)
  }
  return false
}

/** Runs a `convex` CLI command in `apps/web` against the backend; throws on failure. */
async function convex(sys: Sys, root: string, envFile: string, args: readonly string[]) {
  // CONVEX_DEPLOYMENT from a shell or a loaded `.env.local` would contradict
  // the self-hosted pair; `--env-file` alone names the deployment.
  const result = await sys.run(
    ['bunx', 'convex', ...args, '--env-file', envFile],
    join(root, 'apps/web'),
    { CONVEX_DEPLOYMENT: '' }
  )
  if (result.code !== 0)
    throw new Error(`convex ${args[0]} ${args[1] ?? ''} failed:\n${result.stderr || result.stdout}`)
  return result.stdout
}

/** Sets the deployment env sign-in needs: the dev server's key's public half, and the test seam. */
async function provision(sys: Sys, root: string, envFile: string, state: string) {
  const jwks = jwksDataUri(await keyIn(join(state, AUTH_KEY_FILE)))
  await convex(sys, root, envFile, ['env', 'set', 'AUTH_JWKS', jwks])
  // `convex/accountLink.ts` links a test account only on the exact 'true'.
  await convex(sys, root, envFile, ['env', 'set', 'TEST_AUTH', 'true'])
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
      {
        PLAYWRIGHT_BROWSERS_PATH: browsers,
      }
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

/** Starts (or finds) the backend and the dev server, seeds once, and waits. Returns the exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  sys: Sys = realSys,
  { root = CHECKOUT_ROOT, home = homedir() }: { root?: string; home?: string } = {}
): Promise<number> {
  let fresh: boolean
  try {
    ;({ fresh } = parseArgs(argv))
  } catch (caught) {
    sys.error((caught as Error).message)
    return 2
  }
  const ports = backendPorts(root)
  const devPort = portFor({ root, ci: false })
  const backendUrl_ = `http://127.0.0.1:${ports.api}`
  const base = `http://localhost:${devPort}`
  const backendUp = (await sys.probe(`${backendUrl_}/version`)) !== undefined
  const devFound = await sys.probe(`${base}/`)
  if (backendUp && devFound === root) {
    sys.log(`[dev-backend] already running: ${base}/build/ on ${backendUrl_}`)
    return 0
  }
  if (backendUp || devFound !== undefined) {
    sys.error(
      `[dev-backend] ${backendUp ? `:${ports.api}` : `:${devPort}`} is already taken (a half-stopped run, or another server). Stop it, then rerun.`
    )
    return 1
  }

  const state = join(root, STATE_DIR)
  if (fresh) rmSync(state, { recursive: true, force: true })
  mkdirSync(state, { recursive: true })
  const children: Child[] = []
  const stopAll = () => {
    for (const child of children.reverse()) child.stop()
  }
  try {
    const pins = backendPins(
      readFileSync(join(root, '.github/actions/convex-backend/action.yml'), 'utf8')
    )
    // `convex dev --local`'s cache, else the state directory (a read-only home).
    const binary = await resolveBinary(sys, pins, [binariesDir(home), join(state, 'binaries')])

    // One secret per state directory, so the admin key survives a restart:
    // created exclusively (`wx`), so an existing one is never overwritten.
    const secretFile = join(state, 'instance-secret')
    const { randomBytes } = await import('node:crypto')
    try {
      writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    const secret = readFileSync(secretFile, 'utf8').trim()
    children.push(
      sys.spawn(
        [
          binary,
          ...['--port', String(ports.api), '--site-proxy-port', String(ports.site)],
          ...['--instance-name', INSTANCE, '--instance-secret', secret],
          // Not optional (see the CI action): an empty origin signs tokens
          // with an empty issuer, and sign-in fails for no named reason.
          ...['--convex-origin', backendUrl_, '--convex-site', `http://127.0.0.1:${ports.site}`],
          ...['--local-storage', join(state, 'storage'), '--disable-beacon'],
          join(state, 'convex_local_backend.sqlite3'),
        ],
        state,
        join(state, 'backend.log')
      )
    )
    if (!(await waitFor(sys, `${backendUrl_}/version`, 60)))
      throw new Error(`the backend did not answer within 60s: see ${join(state, 'backend.log')}`)

    const keygen = await sys.run(
      [binary, 'keygen', 'admin-key', '--instance-name', INSTANCE, '--instance-secret', secret],
      state
    )
    const adminKey = keygen.stdout.trim().split('\n').pop()?.trim()
    if (keygen.code !== 0 || !adminKey) throw new Error('keygen produced no admin key')
    const envFile = join(state, 'convex.env')
    writeFileSync(
      envFile,
      `CONVEX_SELF_HOSTED_URL=${backendUrl_}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`,
      { mode: 0o600 }
    )
    await provision(sys, root, envFile, state)
    sys.log('[dev-backend] pushing apps/web/convex…')
    await convex(sys, root, envFile, ['deploy', '-y'])

    children.push(
      sys.spawn(
        ['bun', '--bun', 'astro', 'dev', '--ignore-lock'],
        join(root, 'apps/web'),
        join(state, 'dev.log'),
        {
          PORT: String(devPort),
          VITE_CONVEX_URL: backendUrl_,
          VITE_TEST_AUTH: 'true',
          TEST_AUTH: 'true',
          AUTH_SIGNING_KEY: await keyIn(join(state, AUTH_KEY_FILE)),
          AUTH_DB: join(state, 'auth.sqlite'),
        }
      )
    )
    // The first request renders a page server-side through a cold Vite.
    if (!(await waitFor(sys, `${base}/`, 120)))
      throw new Error(`the dev server did not answer within 120s: see ${join(state, 'dev.log')}`)

    const seedFile = join(state, 'seed.json')
    if (!existsSync(seedFile)) await seedOnce(sys, root, base, seedFile)
    sys.log(
      [
        `[dev-backend] ready: ${appRoot(base)} on ${backendUrl_}`,
        `  sign in: __appTestSignIn('${SEED_ACCOUNT.email}', '${SEED_ACCOUNT.password}', 'signIn')`,
        `  shoot:   bun run shot :pilot --signed-in   (seeded pages: ${join(STATE_DIR, 'seed.json')})`,
        `  logs:    ${join(STATE_DIR, 'backend.log')}, ${join(STATE_DIR, 'dev.log')}`,
      ].join('\n')
    )
    const exited = Promise.race(children.map((c) => c.exited))
    const which = await Promise.race([
      sys.interrupted().then(() => 'interrupted' as const),
      exited.then(() => 'exited' as const),
    ])
    if (which === 'exited') {
      sys.error(`[dev-backend] a process exited: see ${join(STATE_DIR, '*.log')}`)
      return 1
    }
    return 0
  } catch (caught) {
    sys.error(`[dev-backend] ${(caught as Error).message}`)
    return 1
  } finally {
    stopAll()
  }
}

if (import.meta.main) process.exit(await main())
