#!/usr/bin/env bun
/**
 * check-observability — the repo half of "can an error be reported at all?".
 *
 * Workers Issues is the error tracker (apps/web/src/worker/errorReports.ts).
 * It needs nothing in a Worker's code, so the ways to go blind are all wiring:
 * a browser app that never starts its reporter or whose Worker never routes
 * the report, a CSP that blocks the report before it leaves the page. Each
 * looks exactly like a healthy app with no errors. (A Worker that never turned
 * Issues on is the `workers` check's: tools/check-workers.ts reads every
 * wrangler.jsonc already.) This gate (the `observability` check, so every PR)
 * asserts:
 *
 *   1. the app's observability module posts to `ERROR_REPORT_PATH`,
 *   2. its init is CALLED from both entries: the static pages' islands and the
 *      app's `main.tsx`,
 *   3. its `public/_headers` CSP `connect-src` allows `'self'`, where it posts,
 *      and admits Cloudflare Web Analytics: `script-src` its beacon's origin,
 *      `connect-src` where the beacon posts page loads. The zone's automatic
 *      setup injects the beacon at the edge, so nothing in the source names
 *      it, and a CSP without the two origins records nothing: from the site's
 *      creation until 3.0.0 the dashboard counted one page load in six weeks.
 *   4. its Worker routes `ERROR_REPORT_PATH` to `handleErrorReport`.
 *
 * Every TypeScript assertion reads PARSED source, never raw text, through
 * `Bun.Transpiler` (which drops comments). These files are heavily commented,
 * and a text match is satisfied by the prose — an init call commented out.
 *
 * Usage: bun tools/check-observability.ts
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The module that owns init, relative to the repo root. */
const MODULE_PATH = 'apps/web/src/lib/observability.ts'

/** The entries that must each CALL the init: the static pages' islands and the app's. */
const ENTRY_PATHS = ['apps/web/src/runtime/islands.client.ts', 'apps/web/src/main.tsx']

/** The CSP source: the `_headers` Workers Static Assets reads. */
const HEADERS_PATH = 'apps/web/public/_headers'

/** The Worker's routes, one of which answers the error reports. */
const WORKER_PATH = 'apps/web/src/worker/routes.ts'

/** The handlers the Worker must call. */
const WORKER_HANDLERS = ['handleErrorReport']

const failures: string[] = []

function fail(message: string): void {
  failures.push(`  ${message}`)
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

function checkWiring(): void {
  const module = code(MODULE_PATH)
  if (module === null) {
    fail(`observability module missing at ${MODULE_PATH}`)
  } else if (!/\bERROR_REPORT_PATH\b/.test(module)) {
    fail(`${MODULE_PATH} does not post to ERROR_REPORT_PATH`)
  }

  // An init that is never called is indistinguishable from no init at all.
  for (const entryPath of ENTRY_PATHS) {
    const entry = code(entryPath)
    if (entry === null) {
      fail(`entry missing at ${entryPath}`)
    } else if (!/\binitBrowserObservability\(/.test(entry)) {
      fail(`${entryPath} never calls initBrowserObservability()`)
    }
  }

  // A report posted to a Worker that does not route it is a 404 nobody sees.
  const worker = code(WORKER_PATH)
  if (worker === null) {
    fail(`no Worker routes at ${WORKER_PATH}`)
  } else {
    for (const handler of WORKER_HANDLERS) {
      if (!new RegExp(`\\b${handler}\\(`).test(worker)) {
        fail(`${WORKER_PATH} never calls ${handler}() — those errors reach nothing`)
      }
    }
  }

  const headers = headersFile(HEADERS_PATH)
  if (headers === null) {
    fail(`no CSP source found at ${HEADERS_PATH} — the error report is unguarded`)
    return
  }
  const policy = headers.match(/Content-Security-Policy\s*:\s*([^\n]*)/)?.[1] ?? ''
  const connectSrc = directiveOf(policy, 'connect-src')
  if (connectSrc === null) {
    fail(
      `${HEADERS_PATH} declares no Content-Security-Policy connect-src — the error report is unguarded`
    )
    return
  }
  if (!connectSrc.includes("'self'")) {
    fail(
      `${HEADERS_PATH}: CSP connect-src does not allow 'self' — error reports ` +
        `would be blocked in the browser.\n      got: connect-src ${connectSrc.join(' ')}`
    )
  }
  for (const [name, source] of WEB_ANALYTICS_SOURCES) {
    const sources = directiveOf(policy, name) ?? []
    if (!sources.includes(source)) {
      fail(
        `${HEADERS_PATH}: CSP ${name} does not allow ${source} — the edge-injected ` +
          `Web Analytics beacon would be blocked and the dashboard would record nothing.`
      )
    }
  }
}

console.log('Checking observability wiring (module → entry → Worker → CSP)…')

checkWiring()

if (failures.length > 0) {
  console.error(`\n✗ observability wiring failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log('✓ observability wiring OK')
