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
  })
}
