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
 *   STATIC (default; the `observability` check, so every PR)
 *     Cheap, hermetic, no network. Asserts the wiring a repo can own:
 *       1. each browser app has an observability module reading its expected
 *          DSN env var,
 *       2. that module's init is actually CALLED from the app entry (an
 *          uncalled init is the same as no init),
 *       3. the app's `public/_headers` CSP `connect-src` lists the Sentry
 *          ingest origin — so the beacon can never be silently walled off again,
 *       4. each Cloudflare Worker wraps its export with `withObservability` and
 *          grants `nodejs_als`.
 *
 *   LIVE (`--live`; runs nightly, post-deploy)
 *     The half CI structurally cannot know: whether the DSN is actually
 *     present in the deploy environment. Fetches production, walks every
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
 * constant and each app's `_headers` CSP must agree, and `checkLive` below also
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
  /**
   * The app's Workers config, and the `_headers` its Cloudflare deploy serves.
   *
   * When `wrangler.jsonc` declares `assets`, Cloudflare serves this app from
   * static assets and `_headers` is the ONLY way it gets a policy — nothing in
   * the Worker path adds one. So an absent `_headers` is an outage (no CSP, no
   * HSTS, no X-Frame-Options), not "nothing to check".
   */
  wranglerPath: string
  /** The `_headers` a Workers Static Assets deploy reads; the app's only CSP source. */
  headersPath: string
  /** Production origin, for --live. */
  productionUrl: string
}

const BROWSER_APPS: BrowserApp[] = [
  {
    name: 'srd',
    dsnEnvVar: 'VITE_SENTRY_DSN',
    modulePath: 'apps/srd/src/lib/observability.ts',
    entryPath: 'apps/srd/src/runtime/islands.client.ts',
    wranglerPath: 'apps/srd/wrangler.jsonc',
    headersPath: 'apps/srd/public/_headers',
    productionUrl: 'https://salvageunion.io',
  },
  {
    name: 'itun',
    dsnEnvVar: 'VITE_SENTRY_DSN',
    modulePath: 'apps/itun/src/lib/observability.ts',
    entryPath: 'apps/itun/src/main.tsx',
    wranglerPath: 'apps/itun/wrangler.jsonc',
    headersPath: 'apps/itun/public/_headers',
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
 * Does this `wrangler.jsonc` declare a static-assets binding?
 *
 * Comment lines are stripped FIRST, and that is the whole difficulty. These
 * files are heavily commented and the word `assets` appears throughout the
 * prose — `apps/itun/wrangler.jsonc` alone mentions `/assets/*` five times in
 * explanation before it ever declares the binding. A naive `includes('assets')`
 * would be satisfied by the commentary and would keep passing after someone
 * deleted the real declaration, which is precisely the failure this rule exists
 * to prevent. `check-convex-parity.ts` learned the same lesson the same way.
 */
function declaresStaticAssets(wranglerJsonc: string): boolean {
  const withoutComments = wranglerJsonc
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  return /"assets"\s*:/.test(withoutComments)
}

function connectSrcOfPolicy(policy: string): string | null {
  const directive = policy.split(';').find((d) => d.trim().startsWith('connect-src'))
  return directive ? directive.trim() : null
}

/**
 * Extract `connect-src` from a `_headers` file's `Content-Security-Policy:` line.
 * Returns null when the file declares no CSP at all.
 */
function connectSrcOf(contents: string): string | null {
  const policy = contents.match(/Content-Security-Policy\s*:\s*([^\n]*)/)?.[1]
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

  // If Cloudflare serves this app from static assets, `_headers` is the only
  // thing that can carry a policy there, so its absence is an outage.
  const wrangler = read(app.wranglerPath)
  const headers = read(app.headersPath)
  if (headers === null) {
    if (wrangler !== null && declaresStaticAssets(wrangler)) {
      fail(
        app.name,
        `${app.wranglerPath} declares "assets", so Cloudflare serves this app from ` +
          `static assets — but ${app.headersPath} does not exist. The Worker adds no ` +
          `headers of its own, so the deployed site would ship no CSP, no HSTS and no ` +
          `X-Frame-Options.`
      )
    } else {
      fail(app.name, `no CSP source found at ${app.headersPath} — the Sentry beacon is unguarded`)
    }
    return
  }

  // The CSP half — the one that would have made a provisioned DSN look
  // healthy while silently dropping every event.
  const connectSrc = connectSrcOf(headers)
  if (connectSrc === null) {
    fail(
      app.name,
      `${app.headersPath} declares no Content-Security-Policy connect-src — the ` +
        `Sentry beacon is unguarded`
    )
    return
  }
  if (!connectSrc.includes(SENTRY_INGEST_HOST)) {
    fail(
      app.name,
      `${app.headersPath}: CSP connect-src does not allow ${SENTRY_INGEST_HOST} — Sentry ` +
        `events would be blocked in the browser.\n      got: ${connectSrc}`
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
  // and a CSP can lag a merge or be overridden by a zone-level Transform Rule
  // this repo never sees.
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
        `      ${app.dsnEnvVar} is almost certainly unset in the deploy build environment (or was\n` +
        `      set after the last successful build), so the SDK was tree-shaken out. Error tracking is\n` +
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
 * The Cloudflare Workers surfaces.
 *
 * These are the three that actually serve production after ADR-033, and until
 * they were wired NONE of them reported to Sentry — each installed a bare
 * `console.error`, which lands in Workers Logs, which nothing alerts on.
 *
 * A guard that does not know about a surface cannot fail for it — which is why
 * every production Worker is listed here.
 *
 * Two things are asserted per Worker, and both are needed:
 *
 *   1. the entry module wraps its export with `withObservability`. Without it an
 *      unhandled throw never becomes an event.
 *   2. `wrangler.jsonc` grants `nodejs_als`. `@sentry/cloudflare` imports
 *      `node:async_hooks`; without the flag the Worker THROWS AT RUNTIME rather
 *      than at build, so a missing flag is a production outage that every local
 *      check passes.
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

const WORKER_WRAPPER = /withObservability\(/
const WORKER_IMPORT = /from 'observability\/cloudflare'/
const ALS_FLAG = /"compatibility_flags"\s*:\s*\[[^\]]*"nodejs_als"/

function checkWorkerSurface(surface: WorkerSurface): void {
  const entry = read(surface.entryPath)
  if (entry === null) {
    fail(surface.name, `no Worker entry at ${surface.entryPath}`)
    return
  }

  if (!WORKER_IMPORT.test(entry)) {
    fail(
      surface.name,
      `${surface.entryPath} does not import from 'observability/cloudflare' — ` +
        `this Worker's errors would reach Workers Logs and nothing else.`
    )
  }

  if (!WORKER_WRAPPER.test(entry)) {
    fail(
      surface.name,
      `${surface.entryPath} does not wrap its default export with withObservability() — ` +
        `an unhandled throw never becomes a Sentry event.`
    )
  }

  const config = read(surface.configPath)
  if (config === null) {
    fail(surface.name, `no wrangler config at ${surface.configPath}`)
    return
  }

  if (!ALS_FLAG.test(config)) {
    fail(
      surface.name,
      `${surface.configPath} does not grant "nodejs_als". @sentry/cloudflare imports ` +
        `node:async_hooks, so without it this Worker throws AT RUNTIME — a production ` +
        `outage that every local check passes.`
    )
  }
}

const live = process.argv.includes('--live')

console.log(
  live
    ? 'Probing production for the Sentry SDK…'
    : 'Checking observability wiring (module → entry → CSP, and the Workers)…'
)

for (const app of BROWSER_APPS) {
  if (live) await checkLive(app)
  else checkStatic(app)
}

// Static-only: this is repo layout, and the live probe reads deployed bytes.
if (!live) {
  for (const surface of WORKER_SURFACES) checkWorkerSurface(surface)
}

if (failures.length > 0) {
  console.error(`\n✗ observability ${live ? 'probe' : 'wiring'} failed:\n${failures.join('\n')}\n`)
  process.exit(1)
}

console.log(`✓ observability ${live ? 'probe' : 'wiring'} OK`)
