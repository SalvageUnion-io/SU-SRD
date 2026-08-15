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
 * scoped to Sentry's ingest domain.
 *
 * The REGION is the part that bites. This org is in the EU (`de`); Sentry's
 * default is `us`, and a DSN issued in one region is silently unusable under a
 * CSP written for the other — the beacon is blocked in the browser and the
 * project simply reports nothing, which looks exactly like "no errors". This
 * constant and the two netlify.toml CSPs must agree, and `checkLive` below also
 * compares them against the host in the DSN actually shipped to production, so
 * a region mismatch fails loudly instead of going quiet.
 */
const SENTRY_INGEST_HOST = 'https://*.ingest.de.sentry.io'

/** A Sentry DSN as it appears inlined in a built bundle. */
const DSN_IN_BUNDLE = /https:\/\/[0-9a-f]{16,}@([a-z0-9.-]+\.ingest\.[a-z0-9.-]*sentry\.io)\//i

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
    // Was `src/layouts/BaseLayout.astro`, which carried the init as its own
    // inline module script. With Astro gone there is a single client entry, so
    // the init lives there — one place instead of one per layout.
    entryPath: 'apps/srd/src/runtime/islands.client.ts',
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
function connectSrcOfPolicy(policy: string): string | null {
  const directive = policy.split(';').find((d) => d.trim().startsWith('connect-src'))
  return directive ? directive.trim() : null
}

function connectSrcOf(toml: string): string | null {
  const policy = toml.match(/Content-Security-Policy\s*=\s*"([^"]*)"/)?.[1]
  return policy === undefined ? null : connectSrcOfPolicy(policy)
}

/**
 * Would this `connect-src` actually let a beacon reach `host`? Handles the two
 * source forms that matter here — an exact origin and a leftmost-subdomain
 * wildcard — rather than string-matching a constant, so the answer is about the
 * policy being served rather than about what this repo believes it declared.
 */
function connectSrcPermits(connectSrc: string, host: string): boolean {
  return connectSrc
    .split(/\s+/)
    .slice(1) // drop the "connect-src" directive name itself
    .some((source) => {
      const bare = source.replace(/^https?:\/\//, '').replace(/\/$/, '')
      return bare.startsWith('*.') ? host.endsWith(bare.slice(1)) : bare === host
    })
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

/**
 * Fetch, retrying transient network failures.
 *
 * This probe talks to the public internet from a CI runner, where a dropped
 * socket or a momentary 5xx is ordinary weather — and a failure here OPENS A
 * TRACKING ISSUE. The first real nightly run proved the point: it reported
 * "production unreachable … The socket connection was closed unexpectedly"
 * against a site that was demonstrably up seconds earlier.
 *
 * A probe that cries wolf teaches you to stop reading it, which is precisely
 * the failure this file exists to prevent — so a verdict of "production is
 * dark" has to survive several attempts before it is worth waking anyone.
 *
 * Retries only what is plausibly transient: network errors and 5xx. A 4xx is a
 * real answer from a working server and is returned immediately.
 *
 * ## Both bounds below are load-bearing — the retry ladder outgrew its job
 *
 * This policy is deliberately patient, and patience without a ceiling is a
 * hang. `fetch` has NO default timeout, so one stalled socket blocked the probe
 * forever; and the ladder costs 1+2+4 = 7s per URL, which across the ~43 chunks
 * the two apps actually serve is 301s of retrying — just past the job's
 * `timeout-minutes: 5`. So the nightly job died at exactly its timeout having
 * printed nothing at all, for a week, while the probe itself was healthy and
 * finishes in 3-21s locally. The runner saw weather the laptop did not, and the
 * policy had no way to say so.
 *
 * Hence two ceilings, and a distinct error type for the second:
 *
 *   REQUEST_TIMEOUT_MS  one attempt cannot stall forever
 *   PROBE_BUDGET_MS     the whole probe cannot outlive its own job timeout
 *
 * Budget exhaustion must NOT be reported as "production is dark". It is a
 * statement about the probe's network, not about the deploy, and this job opens
 * a tracking issue — mislabelling it is the cry-wolf failure this retry policy
 * was written to avoid in the first place.
 */
const REQUEST_TIMEOUT_MS = 15_000
const PROBE_BUDGET_MS = 120_000
const probeDeadline = Date.now() + PROBE_BUDGET_MS

/** The probe ran out of wall-clock. Distinct so it never reads as "SDK absent". */
class ProbeBudgetExhausted extends Error {
  constructor(url: string, cause: unknown) {
    super(
      `probe budget of ${PROBE_BUDGET_MS / 1000}s exhausted while fetching ${url} ` +
        `(last error: ${String(cause)})`
    )
    this.name = 'ProbeBudgetExhausted'
  }
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let lastError: unknown = new Error('no attempt made')
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (Date.now() > probeDeadline) throw new ProbeBudgetExhausted(url, lastError)
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status < 500) return res
      lastError = new Error(`HTTP ${res.status}`)
    } catch (error) {
      lastError = error
    }
    if (attempt < attempts - 1) await Bun.sleep(1000 * 2 ** attempt)
  }
  throw lastError
}

/** Absolute-ises every `<script src>` the served HTML references. */
/**
 * Entry points named by the HTML: `<script src>` AND `<link rel=modulepreload>`.
 *
 * modulepreload matters — itun's index.html names its 36 chunks that way and
 * carries only one `<script src>`, so a script-only scan sees almost nothing.
 */
function scriptUrls(html: string, origin: string): string[] {
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/g
  const preloadRe = /<link[^>]+rel=["']modulepreload["'][^>]*href=["']([^"']+)["']/g
  const hrefFirstRe = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']modulepreload["']/g
  const found = [
    ...html.matchAll(scriptRe),
    ...html.matchAll(preloadRe),
    ...html.matchAll(hrefFirstRe),
  ]
    .map((m) => m[1])
    .filter((src): src is string => src !== undefined)
    .map((src) => (src.startsWith('http') ? src : new URL(src, origin).toString()))
  return [...new Set(found)]
}

/** Bare-specifier imports inside an ES module chunk: `from"./x.js"`, `import("./x.js")`. */
const IMPORT_SPECIFIER_RE = /["'`](\.{1,2}\/[A-Za-z0-9._\-/]+\.js|\/[A-Za-z0-9._\-/]+\.js)["'`]/g

/**
 * Every module chunk reachable from the HTML, following import specifiers.
 *
 * Both apps put `initBrowserObservability` — and therefore the inlined DSN —
 * in a chunk that the HTML never names directly. srd's BaseLayout entry is
 * literally `import{n as e}from"./observability.HASH.js";e()`, and itun bundles
 * it into `entityStore-HASH.js`. A scan of only the HTML-named entries finds
 * neither, reports "SDK absent", and concludes production is dark when it is
 * working perfectly. That false negative is worse than no probe: this job is
 * wired to open a tracking issue, and an alarm that cries wolf nightly is the
 * exact broken window e2e-nightly.yml's own comments warn about.
 *
 * Bounded so a pathological graph cannot hang the nightly job.
 */
async function reachableChunks(seeds: string[], origin: string): Promise<Map<string, string>> {
  const MAX_CHUNKS = 200
  const bodies = new Map<string, string>()
  const queue = [...seeds]
  const seen = new Set(seeds)

  while (queue.length > 0 && bodies.size < MAX_CHUNKS) {
    const url = queue.shift()
    if (url === undefined) break
    let body: string
    try {
      body = await (await fetchWithRetry(url)).text()
    } catch (error) {
      // Running out of budget is NOT "this chunk is missing" — swallowing it
      // would walk the rest of the queue finding nothing and report the deploy
      // as dark. Abort and let the caller say what actually happened.
      if (error instanceof ProbeBudgetExhausted) throw error
      // A single unreachable chunk is not proof of absence; keep looking.
      continue
    }
    bodies.set(url, body)

    for (const match of body.matchAll(IMPORT_SPECIFIER_RE)) {
      const spec = match[1]
      if (spec === undefined) continue
      let resolved: string
      try {
        resolved = new URL(spec, url).toString()
      } catch {
        continue
      }
      if (!resolved.startsWith(new URL(origin).origin)) continue
      if (seen.has(resolved)) continue
      seen.add(resolved)
      queue.push(resolved)
    }
  }
  return bodies
}

async function checkLive(app: BrowserApp): Promise<void> {
  let html: string
  // The CSP as ACTUALLY SERVED. Checking the repo's own constant here would be
  // circular — the whole point of a live probe is to test the deployed truth,
  // and a CSP can lag a merge, be overridden in the Netlify UI, or come from a
  // _headers file this repo never sees.
  let servedCsp: string | null = null
  // Announced BEFORE the first network call, so a stall names the app it stalled
  // on. Previously the whole job could be killed having printed nothing.
  console.log(`  [${app.name}] fetching ${app.productionUrl}…`)
  try {
    const res = await fetchWithRetry(app.productionUrl)
    if (!res.ok) {
      fail(app.name, `production fetch failed: HTTP ${res.status} ${app.productionUrl}`)
      return
    }
    servedCsp = res.headers.get('content-security-policy')
    html = await res.text()
  } catch (error) {
    // Same distinction the chunk crawl makes: out of budget is a statement
    // about the probe's own network, and "production unreachable" would point
    // the resulting tracking issue squarely at an innocent deploy.
    if (error instanceof ProbeBudgetExhausted) {
      fail(app.name, `${error.message} — this is a PROBE failure, not evidence the deploy is dark`)
      return
    }
    fail(app.name, `production unreachable (${app.productionUrl}): ${String(error)}`)
    return
  }

  const urls = scriptUrls(html, app.productionUrl)
  if (urls.length === 0) {
    fail(app.name, `no <script src> found at ${app.productionUrl} — cannot verify the bundle`)
    return
  }

  // Follow the module graph — the SDK and the inlined DSN routinely land in a
  // chunk the HTML never names (see reachableChunks).
  let chunks: Map<string, string>
  try {
    chunks = await reachableChunks(urls, app.productionUrl)
  } catch (error) {
    if (error instanceof ProbeBudgetExhausted) {
      fail(app.name, `${error.message} — this is a PROBE failure, not evidence the deploy is dark`)
      return
    }
    throw error
  }
  console.log(`  [${app.name}] scanned ${chunks.size} chunk(s) from ${urls.length} entry point(s)`)
  let sdkFoundIn: string | null = null
  let dsnHost: string | null = null
  let dsnFoundIn: string | null = null

  for (const [url, body] of chunks) {
    if (!sdkFoundIn && SDK_MARKER.test(body)) sdkFoundIn = url
    const host = body.match(DSN_IN_BUNDLE)?.[1]
    if (!dsnHost && host !== undefined) {
      dsnHost = host
      dsnFoundIn = url
    }
  }

  // The INLINED DSN is the signal that matters, not an SDK name. `import.meta.env`
  // is statically replaced at build time, so a DSN in the bytes proves the deploy
  // env carried it; with no DSN the guard folds to false and the SDK is
  // tree-shaken. Checking for the SDK first got this backwards and could also be
  // fooled either way — the string "sentry" appears in unrelated vendor code
  // (itun's entry carries `__sentry_captured__` from a dependency), while srd's
  // real SDK chunk is content-hashed to the innocuous name `dev.HASH.js`.
  if (!dsnHost) {
    fail(
      app.name,
      `No Sentry DSN inlined in any of the ${chunks.size} chunk(s) reachable from ${app.productionUrl}.\n` +
        `      ${app.dsnEnvVar} is almost certainly unset on the Netlify site (or was set after\n` +
        `      the last successful build), so the SDK was tree-shaken out. Error tracking is\n` +
        `      DARK in production.`
    )
    return
  }

  console.log(`  [${app.name}] DSN inlined in ${dsnFoundIn} (ingest ${dsnHost})`)

  if (!sdkFoundIn) {
    fail(
      app.name,
      `[${app.name}] a DSN is inlined but no Sentry SDK code was found in ${chunks.size} chunk(s).\n` +
        `      That combination should be impossible — investigate before trusting this deploy.`
    )
    return
  }

  console.log(`  [${app.name}] Sentry SDK present in ${sdkFoundIn}`)

  // The end-to-end assertion: does the CSP production is SERVING actually let
  // the DSN production is SHIPPING send anything? A mismatch (most easily a
  // us/de region slip) yields a project that reports nothing at all, which is
  // indistinguishable from "no errors happened" — the failure this whole file
  // exists to make loud.
  //
  // Verified against the real thing: with a `de` DSN deployed under the old
  // `us` CSP, an earlier version of this probe that compared the DSN to
  // SENTRY_INGEST_HOST (a constant in THIS repo) reported OK, because the repo
  // constant had already been updated while production had not. Comparing
  // against the served header is what catches it.
  if (!dsnHost) {
    console.log(`  [${app.name}] no DSN inlined in the bundle — skipping CSP reachability check`)
    return
  }
  const servedConnectSrc = servedCsp ? connectSrcOfPolicy(servedCsp) : null
  if (!servedConnectSrc) {
    fail(app.name, `production serves no CSP connect-src; cannot confirm Sentry is reachable`)
    return
  }
  if (!connectSrcPermits(servedConnectSrc, dsnHost)) {
    fail(
      app.name,
      `production ships a DSN pointing at ${dsnHost}, but the CSP it SERVES does not\n` +
        `      permit that origin, so every event is blocked in the browser and the Sentry\n` +
        `      project looks silent.\n` +
        `      served: ${servedConnectSrc}\n` +
        `      expected to allow: ${SENTRY_INGEST_HOST}`
    )
    return
  }
  console.log(`  [${app.name}] served CSP permits ${dsnHost}`)
}

/**
 * The SERVER surfaces, which fail a different way than the browser ones.
 *
 * Each of these owns a shim that configures `observability/node`, and each must
 * import `@sentry/node` ITSELF and pass it in — the shared package takes the SDK
 * as a parameter and imports it for types only. That is not a style rule, it is
 * a deploy constraint, so it gets a check rather than a comment.
 *
 * Netlify's bundler cannot inline `@sentry/node` (dynamic requires under its
 * OpenTelemetry layer), so it externalises the package and copies it beside the
 * file the import RESOLVED FROM. With the import in `packages/observability`,
 * the copy landed in `packages/observability/node_modules/` while the bundled
 * function was emitted at `apps/itun/netlify/functions/*.mjs` — and Node
 * resolves from the emitted file upward, never reaching `packages/`. Every
 * snapshot Function then died at module load:
 *
 *     Cannot find package '@sentry/node' imported from
 *     /var/task/apps/itun/netlify/functions/snapshot-publish.mjs
 *
 * Publish, retrieve and delete all 502'd — sharing entirely down — from a
 * one-line package.json edit. Typecheck, tests, lint and knip were all green,
 * because every one of them resolves modules the way the REPO is laid out, not
 * the way the deployed artifact is. Nothing but a deploy could see it.
 *
 * So: the import must live in the app, and the app must declare the dependency.
 * A missing declaration is the same outage by a different route — it is what
 * removes the `node_modules` entry the bundler copies from.
 */
type ServerSurface = {
  name: string
  /** The shim that calls `createObservability`, relative to repo root. */
  modulePath: string
  /** The manifest that must declare `@sentry/node`. */
  manifestPath: string
}

const SERVER_SURFACES: ServerSurface[] = [
  {
    name: 'itun-functions',
    modulePath: 'apps/itun/netlify/functions/_observability.ts',
    manifestPath: 'apps/itun/package.json',
  },
  {
    name: 'su-assets-functions',
    modulePath: 'apps/su-assets/netlify/functions/_observability.ts',
    manifestPath: 'apps/su-assets/package.json',
  },
  {
    name: 'discord-bot',
    modulePath: 'apps/discord-bot/src/observability.ts',
    manifestPath: 'apps/discord-bot/package.json',
  },
]

/** A VALUE import of the SDK — `import type` is erased and would not resolve. */
const SDK_VALUE_IMPORT = /^\s*import \* as Sentry from '@sentry\/node'$/m

function checkServerSurface(surface: ServerSurface): void {
  const module = read(surface.modulePath)
  if (module === null) {
    fail(surface.name, `no observability module at ${surface.modulePath}`)
    return
  }

  if (!SDK_VALUE_IMPORT.test(module)) {
    fail(
      surface.name,
      `${surface.modulePath} does not value-import the SDK.\n` +
        `      Expected: import * as Sentry from '@sentry/node'\n` +
        '      The shared package takes it as a parameter on purpose; importing it there\n' +
        '      instead makes the deployed Netlify Function unable to resolve it (502 at\n' +
        '      module load). See the header of packages/observability/src/node.ts.'
    )
  }

  const manifest = read(surface.manifestPath)
  if (manifest === null) {
    fail(surface.name, `no manifest at ${surface.manifestPath}`)
    return
  }

  const { dependencies } = JSON.parse(manifest) as { dependencies?: Record<string, string> }
  if (!dependencies?.['@sentry/node']) {
    fail(
      surface.name,
      `${surface.manifestPath} does not list @sentry/node in "dependencies".\n` +
        "      It is what puts the package under this app's node_modules, which is where\n" +
        '      the bundler copies it from. devDependencies is not enough: the Netlify\n' +
        '      build sets NODE_ENV=production, so it must not depend on dev installs.'
    )
  }
}

/**
 * The shared package must NOT value-import the SDK — that is the exact edit
 * that took production down, so it is asserted from both ends.
 */
function checkSharedPackage(): void {
  const shared = read('packages/observability/src/node.ts')
  if (shared === null) {
    failures.push('  [observability] packages/observability/src/node.ts is missing')
    return
  }
  if (SDK_VALUE_IMPORT.test(shared)) {
    failures.push(
      '  [observability] packages/observability/src/node.ts value-imports @sentry/node.\n' +
        '      It must import it for TYPES only (`import type * as SentryNode`) and take\n' +
        '      the SDK as a parameter — otherwise the bundler resolves it here and the\n' +
        '      deployed Netlify Functions 502 at module load.'
    )
  }
}

const live = process.argv.includes('--live')

console.log(
  live
    ? 'Probing production for the Sentry SDK…'
    : 'Checking observability wiring (module → entry → CSP, and the server surfaces)…'
)

for (const app of BROWSER_APPS) {
  if (live) await checkLive(app)
  else checkStatic(app)
}

// Static-only: this is repo layout, and the live probe reads deployed bytes.
if (!live) {
  checkSharedPackage()
  for (const surface of SERVER_SURFACES) checkServerSurface(surface)
}

if (failures.length > 0) {
  console.error(`\n✗ observability ${live ? 'probe' : 'wiring'} failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log(`✓ observability ${live ? 'probe' : 'wiring'} OK`)
