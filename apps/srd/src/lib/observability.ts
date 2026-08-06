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
 * (Netlify) as a `PUBLIC_`-prefixed variable so Astro exposes it to the client.
 *
 * CSP note: the browser SDK POSTs events to the ingest host encoded in the
 * DSN. srd ships a strict CSP (see apps/srd/netlify.toml); when a
 * DSN is provisioned, that DSN's ingest origin must be added to `connect-src`
 * or the beacon is blocked. With no DSN there is nothing to send, so the
 * default configuration raises no CSP violation.
 */

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
 * - **`Transition was skipped`** — srd opts into *cross-document* view
 *   transitions declaratively, with `@view-transition { navigation: auto }` in
 *   `src/styles/global.css`. When a second navigation supersedes an in-flight
 *   transition (a fast click, or a click during page load) the browser rejects
 *   the transition's `finished` promise with an `AbortError`. That promise
 *   belongs to the user agent — there is no JS handle of ours to `.catch()`, so
 *   the SDK is the only place it can be dropped. The navigation itself
 *   completes normally; the "error" is the feature working as specified
 *   (issue SRD-A).
 */
const IGNORED_ERRORS = ['Transition was skipped']

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
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryModule) return
  sentryModule.captureException(error, context ? { extra: context } : undefined)
}
