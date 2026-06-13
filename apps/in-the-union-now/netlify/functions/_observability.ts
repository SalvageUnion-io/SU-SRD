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
  Sentry.init({ dsn, environment: process.env.NODE_ENV ?? 'production' })
  enabled = true
}

/** Reports an error to Sentry when enabled; otherwise a no-op. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (enabled) {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  }
}
