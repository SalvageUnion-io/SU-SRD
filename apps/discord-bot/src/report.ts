/**
 * SDK-neutral error reporting for `commands/` and `buttons.ts`.
 *
 * ## Why this exists
 *
 * Shared code names no Sentry SDK, so it can never pull a Node-only SDK into
 * the workerd bundle. The entrypoint (`http/worker.ts`) installs a reporter;
 * until one does, reporting is a no-op, which is exactly right for tests.
 *
 * ## Why module-scope mutable state is safe here
 *
 * Workers forbid async I/O, timers and randomness in global scope — not
 * assignment. A single `let` costs nothing at startup. Each isolate gets its
 * own copy and installs its own reporter, so there is no cross-request bleed.
 */

export type Reporter = (error: unknown, context?: Record<string, unknown>) => void

const noop: Reporter = () => {}

let reporter: Reporter = noop

/**
 * Install the reporter for this process/isolate. Called once by whichever
 * entrypoint booted — `index.ts` for the gateway, `http/worker.ts` for Workers.
 */
export function setReporter(next: Reporter): void {
  reporter = next
}

/**
 * Report an error, if an entrypoint installed a reporter.
 *
 * Never throws: a failure inside error reporting must not become a second
 * error on a path that is already handling one.
 */
export function report(error: unknown, context?: Record<string, unknown>): void {
  try {
    reporter(error, context)
  } catch (reportingError) {
    console.error('error reporter threw:', reportingError)
  }
}
