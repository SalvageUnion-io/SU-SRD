/**
 * _observability — optional Sentry error tracking for the snapshot Netlify
 * Functions.
 *
 * Env-gated: when SENTRY_DSN is unset, every export here is a no-op and no
 * Sentry network calls are made. No DSN is committed — it is supplied via the
 * Netlify site environment. The leading underscore keeps this out of the
 * deployed function routes (Netlify ignores `_`-prefixed files as endpoints).
 */

import * as Sentry from '@sentry/node'

let initialized = false
let enabled = false

/** Initializes Sentry once per cold start, if SENTRY_DSN is configured. */
export function initObservability(): void {
  if (initialized) return
  initialized = true
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    // Tags events with the deployed commit so an error maps back to a
    // specific deploy. COMMIT_REF is a Netlify-provided deploy-metadata var —
    // confirmed present in the *build* shell (netlify.toml's ignore scripts
    // read it directly); whether it also reaches the Function's *runtime*
    // environment is unconfirmed. If release tags don't show up on function
    // errors in Sentry, that's the reason — the fallback is to bake the
    // commit SHA into the bundle at build time (e.g. via an esbuild define)
    // instead of reading it from process.env at runtime.
    release: process.env.COMMIT_REF,
  })
  enabled = true
}

/** Reports an error to Sentry when enabled; otherwise a no-op. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (enabled) {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  }
}
