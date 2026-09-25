/**
 * Transport-neutral error reporting for the snapshot handlers.
 *
 * ## Why this exists
 *
 * The snapshot handlers name no Sentry SDK, so they stay free of any runtime's
 * SDK and testable without one. The entrypoint (`src/worker/index.ts`) installs
 * a reporter; until one does, reporting is a no-op, which is exactly right for
 * tests.
 *
 * This is the same shape as `apps/discord-bot/src/report.ts`, deliberately —
 * two surfaces with the same problem should not invent two solutions.
 *
 * ## Why module-scope mutable state is safe
 *
 * Workers forbid async I/O, timers and randomness in global scope — not
 * assignment. Each isolate gets its own copy and installs its own reporter, so
 * there is no cross-request bleed.
 */

export type SnapshotReporter = (error: unknown, context?: Record<string, unknown>) => void

const noop: SnapshotReporter = () => {}

let reporter: SnapshotReporter = noop

/** Install this process/isolate's reporter. Called once by each entrypoint. */
export function setSnapshotReporter(next: SnapshotReporter): void {
  reporter = next
}

/**
 * Report an error, if an entrypoint installed a reporter.
 *
 * Never throws: a failure inside error reporting must not become a second error
 * on a path that is already handling one.
 */
export function reportSnapshotError(error: unknown, context?: Record<string, unknown>): void {
  try {
    reporter(error, context)
  } catch (reportingError) {
    console.error('snapshot error reporter threw:', reportingError)
  }
}
