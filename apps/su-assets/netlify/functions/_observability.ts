/**
 * _observability — optional Sentry error tracking for the artwork function.
 *
 * Mirrors apps/itun/netlify/functions/_observability.ts exactly; this is the
 * same shape of surface (one Netlify Function, `@sentry/node`, a Blobs store
 * behind it) and there is no reason for the two to drift.
 *
 * Entirely env-gated: when SENTRY_DSN is unset (local dev, tests, forks) every
 * export here is a no-op and no Sentry network calls are made. No DSN is ever
 * committed — it is supplied via the `su-assets` Netlify site environment. The
 * leading underscore keeps this out of the deployed function routes (Netlify
 * ignores `_`-prefixed files as endpoints), which matters more here than on
 * itun: `asset.ts` claims `path: '/*'`, so a second routable function in this
 * directory would be an unclaimed endpoint on the artwork host.
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
    // specific deploy. COMMIT_REF is a Netlify-provided deploy-metadata var;
    // whether it reaches the Function's *runtime* environment is unconfirmed
    // (see the itun module for the same caveat and its fallback).
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
