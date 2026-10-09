#!/usr/bin/env bun
/**
 * check-observability — the repo half of "can Sentry report at all?".
 *
 * Both browser apps gate Sentry on a build-time DSN: with none, the guard folds
 * to `false`, Vite tree-shakes the SDK out, and the app looks identical to a
 * working one. And both ship a strict CSP, whose `connect-src` must list
 * Sentry's ingest origin or every event is blocked in the browser while the
 * project looks healthy. This gate (the `observability` check, so every PR)
 * asserts the wiring the repo owns:
 *
 *   1. each browser app has an observability module reading its DSN env var,
 *   2. that module's init is CALLED from the app entry,
 *   3. the app's `public/_headers` has a CSP `connect-src` listing the Sentry
 *      ingest origin,
 *   4. each Cloudflare Worker's default export is `withObservability(...)` and
 *      its config grants `nodejs_als`.
 *
 * Every assertion reads PARSED source, never raw text: TypeScript goes through
 * `Bun.Transpiler` (which drops comments) and `wrangler.jsonc` through Bun's
 * JSONC loader. These files are heavily commented, and a text match is
 * satisfied by the prose — an init call commented out, an export unwrapped
 * with `withObservability(` still named in a comment, or `nodejs_als` only in
 * a comment all passed the text version of this gate.
 *
 * What the deploy actually carries is checked where it is known: the deploy
 * workflow greps each built bundle for an inlined DSN before upload, and
 * `tools/smoke-production.sh` asserts each served CSP names the ingest host.
 *
 * Usage: bun tools/check-observability.ts
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Sentry's ingest origin, as it must appear in each app's CSP `connect-src`.
 *
 * Wildcarded at the subdomain because the host encodes the Sentry org id
 * (`o<orgid>.ingest.<region>.sentry.io`). The REGION is the part that bites:
 * this org is in the EU (`de`), and a DSN issued in one region is silently
 * unusable under a CSP written for the other. This constant, each app's CSP
 * source and the smoke assertion must agree.
 */
const SENTRY_INGEST_HOST = 'https://*.ingest.de.sentry.io'

type BrowserApp = {
  name: string
  /** DSN env var; must match the module and the deploy workflow. */
  dsnEnvVar: string
  /** Module that owns init, relative to repo root. */
  modulePath: string
  /** Entry that must CALL the init. */
  entryPath: string
  /** The `_headers` Workers Static Assets reads: the app's CSP source. */
  headersPath: string
}

const BROWSER_APPS: BrowserApp[] = [
  {
    name: 'srd',
    dsnEnvVar: 'VITE_SENTRY_DSN',
    modulePath: 'apps/srd/src/lib/observability.ts',
    entryPath: 'apps/srd/src/runtime/islands.client.ts',
    headersPath: 'apps/srd/public/_headers',
  },
  {
    name: 'itun',
    dsnEnvVar: 'VITE_SENTRY_DSN',
    modulePath: 'apps/itun/src/lib/observability.ts',
    entryPath: 'apps/itun/src/main.tsx',
    headersPath: 'apps/itun/public/_headers',
  },
]

/**
 * The Cloudflare Workers that serve production. A guard that does not know
 * about a surface cannot fail for it, so every production Worker is listed.
 *
 * `nodejs_als` is checked because `@sentry/cloudflare` imports
 * `node:async_hooks`: without the flag the Worker throws AT RUNTIME rather than
 * at build, an outage every local check passes.
 */
type WorkerSurface = {
  name: string
  /** The Worker entry named by `main`, relative to repo root. */
  entryPath: string
  /** Its wrangler config, relative to repo root. */
  configPath: string
}

const WORKER_SURFACES: WorkerSurface[] = [
  {
    name: 'srd-worker',
    entryPath: 'apps/srd/src/worker/index.ts',
    configPath: 'apps/srd/wrangler.jsonc',
  },
  {
    name: 'itun-worker',
    entryPath: 'apps/itun/src/worker/index.ts',
    configPath: 'apps/itun/wrangler.jsonc',
  },
  {
    name: 'su-assets-worker',
    entryPath: 'apps/su-assets/src/worker.ts',
    configPath: 'apps/su-assets/wrangler.jsonc',
  },
  {
    name: 'discord-bot-worker',
    entryPath: 'apps/discord-bot/src/http/worker.ts',
    configPath: 'apps/discord-bot/wrangler.jsonc',
  },
]

/** The slice of a `wrangler.jsonc` this gate reads. */
type WranglerConfig = {
  compatibility_flags?: string[]
}

const failures: string[] = []

function fail(app: string, message: string): void {
  failures.push(`  [${app}] ${message}`)
}

function exists(path: string): boolean {
  return existsSync(join(process.cwd(), path))
}

/** A TS/TSX module as code, comments stripped; null when absent. */
function code(path: string): string | null {
  if (!exists(path)) return null
  const loader = path.endsWith('.tsx') ? 'tsx' : 'ts'
  return new Bun.Transpiler({ loader }).transformSync(
    readFileSync(join(process.cwd(), path), 'utf8')
  )
}

/** A `wrangler.jsonc`, parsed; null when absent. */
async function wranglerConfig(path: string): Promise<WranglerConfig | null> {
  if (!exists(path)) return null
  const module = (await import(join(process.cwd(), path))) as { default: WranglerConfig }
  return module.default
}

/** A `_headers` file without its `#` comment lines; null when absent. */
function headersFile(path: string): string | null {
  if (!exists(path)) return null
  return readFileSync(join(process.cwd(), path), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
}

/** The source list of a policy's `connect-src`, or null when it has none. */
function connectSrcOf(policy: string): string[] | null {
  const directive = policy
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([name]) => name === 'connect-src')
  return directive ? directive.slice(1) : null
}

async function checkBrowserApp(app: BrowserApp): Promise<void> {
  const module = code(app.modulePath)
  if (module === null) {
    fail(app.name, `observability module missing at ${app.modulePath}`)
    return
  }
  if (!module.includes(`import.meta.env.${app.dsnEnvVar}`)) {
    fail(app.name, `${app.modulePath} does not read import.meta.env.${app.dsnEnvVar}`)
  }

  // An init that is never called is indistinguishable from no init at all.
  const entry = code(app.entryPath)
  if (entry === null) {
    fail(app.name, `entry missing at ${app.entryPath}`)
  } else if (!/\binitBrowserObservability\(/.test(entry)) {
    fail(app.name, `${app.entryPath} never calls initBrowserObservability()`)
  }

  const headers = headersFile(app.headersPath)
  if (headers === null) {
    fail(app.name, `no CSP source found at ${app.headersPath} — the Sentry beacon is unguarded`)
    return
  }
  const policy = headers.match(/Content-Security-Policy\s*:\s*([^\n]*)/)?.[1]
  const connectSrc = policy === undefined ? null : connectSrcOf(policy)
  if (connectSrc === null) {
    fail(
      app.name,
      `${app.headersPath} declares no Content-Security-Policy connect-src — the Sentry beacon is unguarded`
    )
    return
  }
  if (!connectSrc.includes(SENTRY_INGEST_HOST)) {
    fail(
      app.name,
      `${app.headersPath}: CSP connect-src does not allow ${SENTRY_INGEST_HOST} — Sentry ` +
        `events would be blocked in the browser.\n      got: connect-src ${connectSrc.join(' ')}`
    )
  }
}

async function checkWorkerSurface(surface: WorkerSurface): Promise<void> {
  const entry = code(surface.entryPath)
  if (entry === null) {
    fail(surface.name, `no Worker entry at ${surface.entryPath}`)
    return
  }
  if (!/\bfrom "observability\/cloudflare"/.test(entry)) {
    fail(
      surface.name,
      `${surface.entryPath} does not import from 'observability/cloudflare' — ` +
        `this Worker's errors would reach Workers Logs and nothing else.`
    )
  }
  if (!/^export default withObservability\(/m.test(entry)) {
    fail(
      surface.name,
      `${surface.entryPath}'s default export is not withObservability(...) — ` +
        `an unhandled throw never becomes a Sentry event.`
    )
  }

  const config = await wranglerConfig(surface.configPath)
  if (config === null) {
    fail(surface.name, `no wrangler config at ${surface.configPath}`)
    return
  }
  if (!config.compatibility_flags?.includes('nodejs_als')) {
    fail(
      surface.name,
      `${surface.configPath} does not grant "nodejs_als". @sentry/cloudflare imports ` +
        `node:async_hooks, so without it this Worker throws AT RUNTIME — a production ` +
        `outage that every local check passes.`
    )
  }
}

console.log('Checking observability wiring (module → entry → CSP, and the Workers)…')

for (const app of BROWSER_APPS) await checkBrowserApp(app)
for (const surface of WORKER_SURFACES) await checkWorkerSurface(surface)

if (failures.length > 0) {
  console.error(`\n✗ observability wiring failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log('✓ observability wiring OK')
