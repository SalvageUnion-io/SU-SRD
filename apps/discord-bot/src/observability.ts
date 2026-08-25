/**
 * observability — optional Sentry error tracking for the Discord bot.
 *
 * The wiring lives in `observability/node`; this file is the worker's
 * configuration of it, plus the two things that are genuinely this surface's
 * own: the missing-DSN warning and the liveness log line.
 *
 * Entirely env-gated: when SENTRY_DSN is unset (local dev, tests), every
 * function here is a no-op and no Sentry network calls are made. No DSN is
 * ever committed — it is supplied via the Render worker's environment.
 */

import * as Sentry from '@sentry/node'
import { createObservability } from 'observability/node'
import { config } from './config.js'

const observability = createObservability(
  () => ({
    dsn: config.sentryDsn,
    environment: config.nodeEnv ?? 'production',
    // Tags events with the deployed commit SHA (Render's RENDER_GIT_COMMIT) so a
    // Sentry error maps back to the exact deploy that produced it. Undefined when
    // unset (e.g. local dev) — Sentry simply omits the tag.
    release: config.releaseSha,
    surface: 'the Discord bot worker',
    remediation: 'the Render dashboard (render.yaml declares it sync:false)',
  }),
  Sentry
)

/**
 * Initializes Sentry if SENTRY_DSN is configured. Idempotent and safe to call
 * once at startup.
 *
 * The missing-DSN warning used to live here, hand-written, and was this repo's
 * only one — both Netlify surfaces came up silent. It now comes from the shared
 * factory (`surface` / `remediation` above), so the three server surfaces cannot
 * drift on whether they announce being blind.
 */
export function initObservability(): void {
  if (observability.enabled) return
  if (!observability.init()) return
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
  await observability.flush(timeoutMs)
}

/**
 * Reports an error to Sentry when enabled. Always returns immediately; the
 * caller is still responsible for any local logging it wants.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  observability.captureException(error, context)
}

/*
 * There is deliberately no `captureMessage` export here.
 *
 * It existed for exactly one caller — the `discord-bot ready` liveness event —
 * and that is now a cron monitor. An info event proves only that the process was
 * alive at the moment it was sent, which is never the moment you care about, so
 * re-adding this to signal health would be re-adding the bug. Errors go through
 * `captureException`; liveness goes through `startLivenessHeartbeat`.
 */

/** Sentry cron monitor slug. Changing it starts a new monitor and orphans the old one. */
const HEARTBEAT_MONITOR_SLUG = 'discord-bot-heartbeat'

/** How often the worker checks in. Kept in step with the schedule below by construction. */
const HEARTBEAT_INTERVAL_MINUTES = 5

/** Set while a heartbeat is running; also the idempotence guard below. */
let stopHeartbeat: (() => void) | null = null

/**
 * Begin reporting "this worker is alive" to Sentry as a cron monitor.
 *
 * A Render worker exposes no HTTP port, so there is nothing to health-probe and
 * a dead bot looks exactly like a quiet one. This is the replacement for the
 * `discord-bot ready` info event, which could not do the job: Sentry alerts on
 * events arriving, never on their absence, so the silence that meant "the worker
 * went dark" was precisely the case that raised nothing. It also accrued into a
 * permanent error-category issue (SU-DISCORD-1) that had to be archived to keep
 * the queue readable, which retired the signal altogether.
 *
 * With a monitor, Sentry holds the expected cadence and a **missed** check-in is
 * the alert. `checkinMargin` absorbs a slow tick or a redeploy;
 * `failureIssueThreshold: 2` means one blip is not an incident, while a genuinely
 * dead worker opens one after ~12 minutes.
 *
 * `isAlive` is re-asked on every tick — pass the client's live connection state,
 * not a value captured at login, or the monitor reports a running process rather
 * than a working bot.
 *
 * Idempotent: calling it twice does not start a second timer, so a reconnect
 * cannot stack heartbeats.
 */
export function startLivenessHeartbeat(isAlive: () => boolean): void {
  if (stopHeartbeat) return
  stopHeartbeat = observability.startHeartbeat({
    monitorSlug: HEARTBEAT_MONITOR_SLUG,
    intervalMs: HEARTBEAT_INTERVAL_MINUTES * 60_000,
    // Re-asked every tick. Reaching `handleReady` proves the bot was connected
    // once; only this proves it still is. Without it a worker that stays up
    // after losing its gateway session reports `ok` forever — the exact silence
    // this monitor exists to break.
    isAlive,
    monitorConfig: {
      schedule: { type: 'interval', value: HEARTBEAT_INTERVAL_MINUTES, unit: 'minute' },
      checkinMargin: 2,
      maxRuntime: 1,
      timezone: 'UTC',
      failureIssueThreshold: 2,
      recoveryThreshold: 1,
    },
  })
}

/**
 * Stops the heartbeat.
 *
 * Called from the `uncaughtException` path in `index.ts`, before the flush: a
 * process on its way out must not report itself alive on the way, and a tick
 * landing mid-flush would add an event to the buffer being drained.
 */
export function stopLivenessHeartbeat(): void {
  stopHeartbeat?.()
  stopHeartbeat = null
}
