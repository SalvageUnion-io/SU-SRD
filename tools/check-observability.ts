#!/usr/bin/env bun
/**
 * check-observability — the repo half of "can an error be reported at all?".
 *
 * Workers Issues is the error tracker (packages/observability/src/cloudflare.ts).
 * It needs nothing in a Worker's code, so the ways to go blind are all wiring:
 * a Worker that never turned Issues on, a browser app that never starts its
 * reporter or whose Worker never routes the report, a CSP that blocks the
 * report before it leaves the page. Each looks exactly like a healthy app with
 * no errors. This gate (the `observability` check, so every PR) asserts:
 *
 *   1. each browser app's observability module posts to `ERROR_REPORT_PATH`,
 *   2. its init is CALLED from the app entry,
 *   3. its `public/_headers` CSP `connect-src` allows `'self'`, where it posts,
 *      and admits Cloudflare Web Analytics: `script-src` its beacon's origin,
 *      `connect-src` where the beacon posts page loads. The zone's automatic
 *      setup injects the beacon at the edge, so nothing in the source names
 *      it, and a CSP without the two origins records nothing: from the site's
 *      creation until 3.0.0 the dashboard counted one page load in six weeks.
 *   4. its Worker routes `ERROR_REPORT_PATH` to `handleErrorReport` (and the Cantina's
 *      routes `CONVEX_LOG_STREAM_PATH` to `handleConvexLogStream`),
 *   5. every Worker's config turns on logs, Issues and `upload_source_maps`.
 *
 * Every assertion reads PARSED source, never raw text: TypeScript goes through
 * `Bun.Transpiler` (which drops comments) and `wrangler.jsonc` through Bun's
 * JSONC loader. These files are heavily commented, and a text match is
 * satisfied by the prose — an init call commented out, or a setting named only
 * in a comment.
 *
 * Usage: bun tools/check-observability.ts
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type BrowserApp = {
  name: string
  /** Module that owns init, relative to repo root. */
  modulePath: string
  /** Entry that must CALL the init. */
  entryPath: string
  /** The `_headers` Workers Static Assets reads: the app's CSP source. */
  headersPath: string
  /** The Worker that answers the app's error reports. */
  workerPath: string
  /** Handlers the Worker must call, beyond `handleErrorReport`. */
  extraHandlers: string[]
}

const BROWSER_APPS: BrowserApp[] = [
  {
    name: 'srd',
    modulePath: 'apps/web/src/lib/observability.ts',
    entryPath: 'apps/web/src/runtime/islands.client.ts',
    headersPath: 'apps/web/public/_headers',
    workerPath: 'apps/web/src/worker/index.ts',
    extraHandlers: [],
  },
  {
    name: 'cantina',
    modulePath: 'apps/web/src/cantina/lib/observability.ts',
    entryPath: 'apps/web/src/cantina/main.tsx',
    headersPath: 'apps/web/src/cantina/public/_headers',
    workerPath: 'apps/web/src/cantina/worker/index.ts',
    extraHandlers: ['handleConvexLogStream'],
  },
]

/**
 * The Cloudflare Workers that serve production. A guard that does not know
 * about a surface cannot fail for it, so every production Worker is listed.
 */
type WorkerSurface = {
  name: string
  /** Its wrangler config, relative to repo root. */
  configPath: string
}

const WORKER_SURFACES: WorkerSurface[] = [
  { name: 'srd-worker', configPath: 'apps/web/wrangler.jsonc' },
  { name: 'su-assets-worker', configPath: 'apps/su-assets/wrangler.jsonc' },
  { name: 'discord-bot-worker', configPath: 'apps/discord-bot/wrangler.jsonc' },
]

/** The slice of a `wrangler.jsonc` this gate reads. */
type WranglerConfig = {
  observability?: { enabled?: boolean; issues?: { enabled?: boolean } }
  upload_source_maps?: boolean
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

/** The source list of a policy's `name` directive, or null when it has none. */
function directiveOf(policy: string, name: string): string[] | null {
  const directive = policy
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([directiveName]) => directiveName === name)
  return directive ? directive.slice(1) : null
}

/**
 * Cloudflare Web Analytics' two origins, by the directive that must allow
 * each: the edge-injected beacon loads from the first and posts to the second.
 */
const WEB_ANALYTICS_SOURCES = [
  ['script-src', 'https://static.cloudflareinsights.com'],
  ['connect-src', 'https://cloudflareinsights.com'],
] as const

function checkBrowserApp(app: BrowserApp): void {
  const module = code(app.modulePath)
  if (module === null) {
    fail(app.name, `observability module missing at ${app.modulePath}`)
  } else if (!/\bERROR_REPORT_PATH\b/.test(module)) {
    fail(app.name, `${app.modulePath} does not post to ERROR_REPORT_PATH`)
  }

  // An init that is never called is indistinguishable from no init at all.
  const entry = code(app.entryPath)
  if (entry === null) {
    fail(app.name, `entry missing at ${app.entryPath}`)
  } else if (!/\binitBrowserObservability\(/.test(entry)) {
    fail(app.name, `${app.entryPath} never calls initBrowserObservability()`)
  }

  // A report posted to a Worker that does not route it is a 404 nobody sees.
  const worker = code(app.workerPath)
  if (worker === null) {
    fail(app.name, `no Worker entry at ${app.workerPath}`)
  } else {
    for (const handler of ['handleErrorReport', ...app.extraHandlers]) {
      if (!new RegExp(`\\b${handler}\\(`).test(worker)) {
        fail(app.name, `${app.workerPath} never calls ${handler}() — those errors reach nothing`)
      }
    }
  }

  const headers = headersFile(app.headersPath)
  if (headers === null) {
    fail(app.name, `no CSP source found at ${app.headersPath} — the error report is unguarded`)
    return
  }
  const policy = headers.match(/Content-Security-Policy\s*:\s*([^\n]*)/)?.[1] ?? ''
  const connectSrc = directiveOf(policy, 'connect-src')
  if (connectSrc === null) {
    fail(
      app.name,
      `${app.headersPath} declares no Content-Security-Policy connect-src — the error report is unguarded`
    )
    return
  }
  if (!connectSrc.includes("'self'")) {
    fail(
      app.name,
      `${app.headersPath}: CSP connect-src does not allow 'self' — error reports ` +
        `would be blocked in the browser.\n      got: connect-src ${connectSrc.join(' ')}`
    )
  }
  for (const [name, source] of WEB_ANALYTICS_SOURCES) {
    const sources = directiveOf(policy, name) ?? []
    if (!sources.includes(source)) {
      fail(
        app.name,
        `${app.headersPath}: CSP ${name} does not allow ${source} — the edge-injected ` +
          `Web Analytics beacon would be blocked and the dashboard would record nothing.`
      )
    }
  }
}

async function checkWorkerSurface(surface: WorkerSurface): Promise<void> {
  const config = await wranglerConfig(surface.configPath)
  if (config === null) {
    fail(surface.name, `no wrangler config at ${surface.configPath}`)
    return
  }
  if (config.observability?.enabled !== true) {
    fail(surface.name, `${surface.configPath} does not turn on "observability" (Workers Logs)`)
  }
  if (config.observability?.issues?.enabled !== true) {
    fail(
      surface.name,
      `${surface.configPath} does not turn on "observability.issues" — this Worker's ` +
        `errors would be logged and grouped by nothing.`
    )
  }
  if (config.upload_source_maps !== true) {
    fail(
      surface.name,
      `${surface.configPath} does not set "upload_source_maps" — its issues would ` +
        `point at the bundle, not the source.`
    )
  }
}

console.log('Checking observability wiring (module → entry → Worker → CSP, and the Workers)…')

for (const app of BROWSER_APPS) checkBrowserApp(app)
for (const surface of WORKER_SURFACES) await checkWorkerSurface(surface)

if (failures.length > 0) {
  console.error(`\n✗ observability wiring failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log('✓ observability wiring OK')
