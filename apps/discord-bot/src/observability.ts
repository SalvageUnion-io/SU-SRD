/**
 * observability — optional Sentry error tracking for the Discord bot.
 *
 * Entirely env-gated: when SENTRY_DSN is unset (local dev, tests), every
 * function here is a no-op and no Sentry network calls are made. No DSN is
 * ever committed — it is supplied via the Render worker's environment.
 */

import * as Sentry from '@sentry/node'
import { config } from './config.js'

let enabled = false

/**
 * Initializes Sentry if SENTRY_DSN is configured. Idempotent and safe to call
 * once at startup. No-op (and logs nothing) when the DSN is absent.
 */
export function initObservability(): void {
  if (enabled || !config.sentryDsn) return
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv ?? 'production',
  })
  enabled = true
  console.log('[observability] Sentry error tracking enabled')
}

/**
 * Reports an error to Sentry when enabled. Always returns immediately; the
 * caller is still responsible for any local logging it wants.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (enabled) {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  }
}
