/**
 * observability — optional browser Sentry error tracking for ITUN.
 *
 * Entirely env-gated, mirroring the backend discipline
 * (apps/discord-bot/src/observability.ts and the snapshot function's
 * netlify/functions/_observability.ts): when `VITE_SENTRY_DSN` is unset (local
 * dev, tests, and any deploy without the var provisioned) this is a no-op and
 * no Sentry code runs or ships. Because the DSN is read from `import.meta.env`
 * — which Vite statically inlines at build — an unset DSN makes the
 * `@sentry/browser` dynamic import unreachable, so it is tree-shaken out of the
 * client bundle entirely.
 *
 * No DSN is ever committed; it is supplied via the host's build environment
 * (Netlify) as a `VITE_`-prefixed variable so Vite exposes it to the client.
 * This is the client counterpart to the server-side `SENTRY_DSN` used by the
 * snapshot Netlify function.
 */

let initialized = false

/**
 * Initializes browser Sentry when `VITE_SENTRY_DSN` is configured. Idempotent
 * and safe to call once on load. Resolves immediately (no-op) when the DSN is
 * absent.
 */
export async function initBrowserObservability(): Promise<void> {
  if (initialized) return

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  initialized = true

  const Sentry = await import('@sentry/browser')
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Errors only — no performance tracing or session replay. Keeps network
    // chatter minimal and avoids additional CSP surface.
    tracesSampleRate: 0,
  })
}
