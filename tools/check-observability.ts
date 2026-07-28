#!/usr/bin/env bun
/**
 * check-observability — guards the two ways browser error tracking goes dark.
 *
 * Both apps ship a fully-built, unit-tested, release-tagged Sentry integration
 * that is env-gated on a DSN. That design is correct, and it is also silent:
 * with no DSN the guard folds to `false` at build time, Vite tree-shakes the
 * SDK out entirely, and the app looks *identical* to a working one. There is no
 * warning, no console message and no failed build. Both apps sat in production
 * this way — SDK absent from the shipped bundle, zero events ever captured —
 * and nothing in CI noticed, because nothing was looking.
 *
 * Worse, turning the DSN on alone would NOT have fixed it: both sites ship a
 * strict CSP whose `connect-src` did not list Sentry's ingest origin, so every
 * event would have been blocked in the browser before it left the page. That
 * failure mode is strictly nastier than the first — it reports zero errors and
 * *looks healthy*.
 *
 * So the two halves must be checked together, and they are checked at the two
 * different places they can break:
 *
 *   STATIC (default; runs in `validate:all`, so every PR)
 *     Cheap, hermetic, no network. Asserts the wiring a repo can own:
 *       1. each browser app has an observability module reading its expected
 *          DSN env var,
 *       2. that module's init is actually CALLED from the app entry (an
 *          uncalled init is the same as no init),
 *       3. the app's `netlify.toml` CSP `connect-src` lists the Sentry ingest
 *          origin — so the beacon can never be silently walled off again.
 *
 *   LIVE (`--live`; runs nightly, post-deploy)
 *     The half CI structurally cannot know: whether the DSN is actually
 *     provisioned in the Netlify dashboard. Fetches production, walks every
 *     script the HTML references, and asserts the SDK is really in the bytes
 *     being served. This is the check whose absence let the whole stack sit
 *     dark — it is the only one that tests the deployed truth.
 *
 * Usage:
 *   bun tools/check-observability.ts           # static wiring (CI, every PR)
 *   bun tools/check-observability.ts --live    # production probe (nightly)
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Sentry's ingest origin, as it must appear in each app's CSP `connect-src`.
 *
 * Wildcarded at the subdomain because the host encodes the Sentry org id
 * (`o<orgid>.ingest.<region>.sentry.io`); pinning the literal org would mean a
 * CSP edit every time a project moves org, and the wildcard is still tightly
 * scoped to Sentry's ingest domain. `us` is Sentry's default data region — an
 * EU-region org ingests at `*.ingest.de.sentry.io`, so this constant (and the
 * two netlify.toml CSPs that must match it) is the single place to change.
 */
const SENTRY_INGEST_HOST = 'https://*.ingest.us.sentry.io'

/** A marker that only appears once the Sentry SDK is really in a bundle. */
const SDK_MARKER = /sentry/i

type BrowserApp = {
  name: string
  /** Framework-prefixed DSN env var; must match the module and the host. */
  dsnEnvVar: string
  /** Module that owns init, relative to repo root. */
  modulePath: string
  /** Entry that must CALL the init. */
  entryPath: string
  /** netlify.toml carrying the CSP. */
  netlifyTomlPath: string
  /** Production origin, for --live. */
  productionUrl: string
}

const BROWSER_APPS: BrowserApp[] = [
  {
    name: 'srd',
    dsnEnvVar: 'PUBLIC_SENTRY_DSN',
    modulePath: 'apps/srd/src/lib/observability.ts',
    entryPath: 'apps/srd/src/layouts/BaseLayout.astro',
    netlifyTomlPath: 'apps/srd/netlify.toml',
    productionUrl: 'https://salvageunion.io',
  },
  {
    name: 'itun',
    dsnEnvVar: 'VITE_SENTRY_DSN',
    modulePath: 'apps/itun/src/lib/observability.ts',
    entryPath: 'apps/itun/src/main.tsx',
    netlifyTomlPath: 'apps/itun/netlify.toml',
    productionUrl: 'https://intheunionnow.com',
  },
]

const failures: string[] = []

function fail(app: string, message: string): void {
  failures.push(`  [${app}] ${message}`)
}

function read(path: string): string | null {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

/**
 * Pulls the `connect-src` directive out of a netlify.toml's CSP header.
 * Returns null when the file declares no CSP at all (which is itself a finding
 * for an app that ships one).
 */
function connectSrcOf(toml: string): string | null {
  const csp = toml.match(/Content-Security-Policy\s*=\s*"([^"]*)"/)
  if (!csp) return null
  const directive = csp[1].split(';').find((d) => d.trim().startsWith('connect-src'))
  return directive ? directive.trim() : null
}

function checkStatic(app: BrowserApp): void {
  const module = read(app.modulePath)
  if (!module) {
    fail(app.name, `observability module missing at ${app.modulePath}`)
    return
  }
  if (!module.includes(app.dsnEnvVar)) {
    fail(app.name, `${app.modulePath} does not read ${app.dsnEnvVar}`)
  }

  // An init that is never called is indistinguishable from no init at all.
  const entry = read(app.entryPath)
  if (!entry) {
    fail(app.name, `entry missing at ${app.entryPath}`)
  } else if (!entry.includes('initBrowserObservability')) {
    fail(app.name, `${app.entryPath} never calls initBrowserObservability()`)
  }

  // The CSP half — the one that would have made a provisioned DSN look
  // healthy while silently dropping every event.
  const toml = read(app.netlifyTomlPath)
  if (!toml) {
    fail(app.name, `netlify.toml missing at ${app.netlifyTomlPath}`)
    return
  }
  const connectSrc = connectSrcOf(toml)
  if (connectSrc === null) {
    fail(app.name, `${app.netlifyTomlPath} declares no Content-Security-Policy connect-src`)
  } else if (!connectSrc.includes(SENTRY_INGEST_HOST)) {
    fail(
      app.name,
      `CSP connect-src does not allow ${SENTRY_INGEST_HOST} — Sentry events ` +
        `would be blocked in the browser.\n      got: ${connectSrc}`
    )
  }
}

/** Absolute-ises every `<script src>` the served HTML references. */
function scriptUrls(html: string, origin: string): string[] {
  const re = /<script[^>]+src=["']([^"']+)["']/g
  return [...html.matchAll(re)].map(([, src]) =>
    src.startsWith('http') ? src : new URL(src, origin).toString()
  )
}

async function checkLive(app: BrowserApp): Promise<void> {
  let html: string
  try {
    const res = await fetch(app.productionUrl, { redirect: 'follow' })
    if (!res.ok) {
      fail(app.name, `production fetch failed: HTTP ${res.status} ${app.productionUrl}`)
      return
    }
    html = await res.text()
  } catch (error) {
    fail(app.name, `production unreachable (${app.productionUrl}): ${String(error)}`)
    return
  }

  const urls = scriptUrls(html, app.productionUrl)
  if (urls.length === 0) {
    fail(app.name, `no <script src> found at ${app.productionUrl} — cannot verify the bundle`)
    return
  }

  for (const url of urls) {
    try {
      const body = await (await fetch(url)).text()
      if (SDK_MARKER.test(body)) {
        console.log(`  [${app.name}] Sentry SDK present in ${url}`)
        return
      }
    } catch {
      // A single unreachable chunk is not proof of absence; keep looking.
    }
  }

  fail(
    app.name,
    `Sentry SDK absent from all ${urls.length} script(s) served by ${app.productionUrl}.\n` +
      `      The DSN (${app.dsnEnvVar}) is almost certainly unset on the Netlify site, so the\n` +
      `      SDK was tree-shaken out of the build. Error tracking is DARK in production.`
  )
}

const live = process.argv.includes('--live')

console.log(
  live
    ? 'Probing production for the Sentry SDK…'
    : 'Checking observability wiring (module → entry → CSP)…'
)

for (const app of BROWSER_APPS) {
  if (live) await checkLive(app)
  else checkStatic(app)
}

if (failures.length > 0) {
  console.error(`\n✗ observability ${live ? 'probe' : 'wiring'} failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log(`✓ observability ${live ? 'probe' : 'wiring'} OK`)
