/**
 * observability — optional browser Sentry error tracking for srd.
 *
 * Entirely env-gated, mirroring the Discord bot's discipline
 * (apps/discord-bot/src/observability.ts): when `PUBLIC_SENTRY_DSN` is unset
 * (local dev, tests, and any deploy without the var provisioned) this is a
 * no-op and no Sentry code runs or ships. Because the DSN is read from
 * `import.meta.env` — which Vite statically inlines at build — an unset DSN
 * makes the `@sentry/browser` dynamic import unreachable, so it is
 * tree-shaken out of the client bundle entirely.
 *
 * No DSN is ever committed; it is supplied via the host's build environment
 * (Netlify) as a `PUBLIC_`-prefixed variable. The prefix is Astro-era naming
 * kept deliberately: Astro is long gone, and it works only because
 * `ssg/vite.config.ts` sets `envPrefix: 'PUBLIC_'` for exactly this reason.
 * Renaming it to `VITE_` is a coordinated live-site env change, not a
 * drive-by — see the same variable in `netlify.toml` and `deploy-cloudflare.yml`.
 *
 * CSP note: the browser SDK POSTs events to the ingest host encoded in the
 * DSN. srd ships a strict CSP (see apps/srd/netlify.toml); when a
 * DSN is provisioned, that DSN's ingest origin must be added to `connect-src`
 * or the beacon is blocked. With no DSN there is nothing to send, so the
 * default configuration raises no CSP violation.
 */

import type { CaptureOptions } from 'observability/browser'
import { buildCaptureHint } from 'observability/browser'

let initialized = false
let sentryModule: typeof import('@sentry/browser') | null = null

/**
 * Browser noise that is not this site's to fix, dropped before it is sent.
 *
 * The bar for adding to this list is deliberately high: a filtered error is one
 * nobody will ever see again, so anything here has to be something we could not
 * act on even if we wanted to. Each entry names the mechanism, not just the
 * string.
 *
 * All three entries below are the same mechanism wearing three different
 * messages. srd opts into *cross-document* view transitions declaratively, with
 * `@view-transition { navigation: auto }` in `src/styles/global.css`. The
 * promises that transition exposes belong to the **user agent** — there is no JS
 * handle of ours to `.catch()` — so when the browser abandons a transition it
 * rejects one of them and Sentry's `onunhandledrejection` handler reports it. In
 * every case the navigation itself completes normally, which is why the SDK is
 * the only place these can be dropped.
 *
 * - **`Transition was skipped`** — a second navigation supersedes an in-flight
 *   transition (a fast click, or a click during page load). Chrome's wording
 *   (issue SRD-A).
 * - **`Skipping view transition`** — the same abandonment, worded
 *   `Skipping view transition because skipTransition() was called.`, which is
 *   what WebKit and the iOS in-app browsers emit. The `skipTransition()` call
 *   is the browser's own, not ours: nothing in this app has a
 *   `ViewTransition` handle to call it on (issue SRD-B, and by event count the
 *   loudest of the three).
 * - **`Transition was aborted because of invalid state`** — the document was
 *   made ineligible mid-transition, typically by being backgrounded or hidden.
 *   Reported as an `InvalidStateError` rather than an `AbortError`, so the
 *   error *type* is no help in grouping these; the message is (issue SRD-D).
 *
 * Matched as substrings of Sentry's `${type}: ${value}`, so each entry covers
 * the DOMException name prefix the events actually carry.
 */
const IGNORED_ERRORS = [
  'Transition was skipped',
  'Skipping view transition',
  'Transition was aborted because of invalid state',
]

/**
 * Netlify's Real User Metrics beacon, injected into every page by the platform.
 *
 * It is enabled per-site in the Netlify UI, not in this repo, and it is not
 * loaded, wrapped or called by any code here.
 */
const NETLIFY_RUM_SCRIPT = '/.netlify/scripts/rum'

/** The slice of a Sentry event this filter reads — see `buildCaptureHint` for why it is spelled out. */
type EventWithFrames = {
  exception?: {
    values?: Array<{ stacktrace?: { frames?: Array<{ filename?: string }> } }>
  }
}

/**
 * True when the event is Netlify's RUM beacon failing to reach its collector.
 *
 * The beacon POSTs to `ingesteer.services-prod.nsvcs.net/rum_collection` on
 * `pagehide`/`visibilitychange` and does not catch the rejection. That is a
 * `TypeError: Failed to fetch` in Chrome and `TypeError: Load failed` in Safari
 * (issues SRD-4 and SRD-E, together the second-largest source of events in this
 * project), fired whenever a content blocker, a captive portal, or simply a
 * page being closed mid-flight stops the request. It is unactionable here: we
 * neither call it nor can we make it stop.
 *
 * This is a `beforeSend` rather than an `ignoreErrors` entry, and rather than
 * `denyUrls`, for two separate reasons:
 *
 * - `ignoreErrors: ['Failed to fetch']` would also silence every genuine fetch
 *   failure in this app — far too blunt for a message that generic.
 * - `denyUrls` matches the *last* usable frame, and Sentry's own `fetch`
 *   instrumentation sits on top of the RUM frames, so the frame it tests is
 *   this site's bundle. It would not match.
 *
 * Keying on any frame naming the RUM script is precise: no first-party stack can
 * contain it.
 */
export function isNetlifyRumFailure(event: EventWithFrames): boolean {
  return (
    event.exception?.values?.some((value) =>
      value.stacktrace?.frames?.some((frame) => frame.filename?.includes(NETLIFY_RUM_SCRIPT))
    ) ?? false
  )
}

/**
 * Initializes browser Sentry when `PUBLIC_SENTRY_DSN` is configured.
 * Idempotent and safe to call once on every page load. Resolves immediately
 * (no-op) when the DSN is absent.
 */
export async function initBrowserObservability(): Promise<void> {
  if (initialized) return

  const dsn = import.meta.env.PUBLIC_SENTRY_DSN
  if (!dsn) return

  initialized = true

  const Sentry = await import('@sentry/browser')
  sentryModule = Sentry
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Tags events with the deployed commit so an error maps back to a
    // specific deploy. PUBLIC_COMMIT_REF is set by netlify.toml's build
    // command (`PUBLIC_COMMIT_REF="$COMMIT_REF" bun ... build`), mirroring
    // Netlify's own COMMIT_REF; unset locally, so dev builds simply omit the
    // tag.
    release: import.meta.env.PUBLIC_COMMIT_REF || undefined,
    // Errors only — no performance tracing or session replay. Keeps network
    // chatter minimal and avoids additional CSP surface.
    tracesSampleRate: 0,
    ignoreErrors: IGNORED_ERRORS,
    beforeSend: (event) => (isNetlifyRumFailure(event) ? null : event),
  })
}

/**
 * Reports a caught exception to Sentry when enabled; otherwise a no-op.
 *
 * This exists because catching is exactly what PREVENTS an error reaching
 * Sentry's `globalHandlers` integration. Until now neither browser app
 * exported a capture verb at all (the node-side modules —
 * `apps/discord-bot/src/observability.ts` and
 * `apps/itun/netlify/functions/_observability.ts` — both did), so every
 * deliberately-caught error in the browser was structurally unreportable and
 * a render crash inside an island produced no production signal whatsoever.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
  options?: CaptureOptions
): void {
  if (!sentryModule) return
  sentryModule.captureException(error, buildCaptureHint(context, options))
}
