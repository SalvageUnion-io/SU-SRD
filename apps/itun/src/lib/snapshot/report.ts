/**
 * Transport-neutral error reporting for the snapshot handlers.
 *
 * ## Why this exists
 *
 * The three snapshot handler factories are shared by two runtimes: Netlify
 * Functions (Node) today, and a Cloudflare Worker (workerd) after ADR-033. They
 * imported `captureException` from `netlify/lib/observability`, which imports
 * `@sentry/node` — and `@sentry/node` drags in OpenTelemetry,
 * `require-in-the-middle` and `node:path`, none of which bundle for workerd.
 *
 * The tempting fix is `nodejs_compat`. That is wrong twice over: it grows the
 * bundle with a Node shim the Worker does not otherwise need, and it makes the
 * *next* accidental Node-only import invisible — the build keeps passing while
 * pulling server code into an edge runtime.
 *
 * So the shared handlers name no transport. Each entrypoint installs a reporter:
 * the Netlify functions install Sentry, the Worker installs its own. Until one
 * does, reporting is a no-op, which is exactly right for tests.
 *
 * This is the same shape as `apps/discord-bot/src/report.ts`, deliberately —
 * two surfaces with the same problem should not invent two solutions.
 *
 * ## Why module-scope mutable state is safe
 *
 * Workers forbid async I/O, timers and randomness in global scope — not
 * assignment. Each isolate gets its own copy and installs its own reporter, so
 * there is no cross-request bleed; the same holds for a Node function instance.
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
