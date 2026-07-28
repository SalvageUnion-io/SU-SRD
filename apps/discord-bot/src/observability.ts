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
 * once at startup. Warns (once) when the DSN is absent so a mis-provisioned
 * production worker is visible in the Render logs instead of silently blind.
 */
export function initObservability(): void {
  if (enabled) return
  if (!config.sentryDsn) {
    console.warn(
      '[observability] SENTRY_DSN not set — error tracking disabled. ' +
        'Set it in the Render dashboard (render.yaml declares it sync:false).'
    )
    return
  }
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv ?? 'production',
    // Tags events with the deployed commit SHA (Render's RENDER_GIT_COMMIT)
    // so a Sentry error maps back to the exact deploy that produced it.
    // Undefined when unset (e.g. local dev) — Sentry simply omits the tag.
    release: config.releaseSha,
  })
  enabled = true
  // Deliberately avoids the word "error": Render classifies log level from
  // message *content*, not the stream it arrived on. This is a console.log on
  // stdout, exactly like the "Starting Salvage Union Discord Bot..." line that
  // Render files as `info` — but while it read "Sentry error tracking enabled"
  // Render filed it as `level=error`, so the bot's one success message showed
  // up in every error-level log filter. Keep this string error-free.
  console.log('[observability] Sentry tracking enabled')
}

/**
 * Flush buffered events before process exit. The Sentry transport is async —
 * a synchronous process.exit() right after captureException drops the one
 * event you most need (the crash Render restarts the worker for). Resolves
 * after the flush completes or the timeout elapses; never rejects.
 */
export async function flushObservability(timeoutMs = 2000): Promise<void> {
  if (!enabled) return
  try {
    await Sentry.flush(timeoutMs)
  } catch {
    // Exiting anyway — nothing useful to do with a flush failure.
  }
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

/**
 * Reports an informational message to Sentry when enabled; otherwise a no-op.
 * Used as the worker's liveness signal (see `handleReady`): a Render worker
 * has no HTTP port to health-probe, so a breadcrumb on every successful login
 * is the cheapest "the process is alive and connected" alert path — a gap in
 * the expected daily cadence of these events is itself the signal.
 */
export function captureMessage(message: string, context?: Record<string, unknown>): void {
  if (enabled) {
    Sentry.captureMessage(message, context ? { extra: context } : undefined)
  }
}
