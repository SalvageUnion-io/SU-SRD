/**
 * Transport-neutral error reporting for code shared by both bot transports.
 *
 * ## Why this exists
 *
 * `commands/` and `buttons.ts` are shared by the gateway entry (`index.ts`,
 * Node/Render) and the HTTP-interactions Worker (`http/worker.ts`, workerd).
 * One of them imported `./observability.js` directly, which imports
 * `@sentry/node` — and `@sentry/node` drags in OpenTelemetry,
 * `require-in-the-middle` and `node:path`, none of which bundle for workerd.
 * The Worker build failed with *"The package 'path' wasn't found on the file
 * system but is built into node"*.
 *
 * The tempting fix is `nodejs_compat`. That would be wrong twice over: it grows
 * the bundle with a Node shim the bot does not otherwise need, and it makes the
 * *next* accidental Node-only import invisible — the build would keep passing
 * while pulling server code into an edge runtime.
 *
 * So shared code names no transport at all. Each entrypoint installs a
 * reporter; until one does, reporting is a no-op, which is exactly right for
 * tests.
 *
 * ## Why module-scope mutable state is safe here
 *
 * Workers forbid async I/O, timers and randomness in global scope — not
 * assignment. A single `let` costs nothing at startup. Each isolate gets its
 * own copy and installs its own reporter, so there is no cross-request bleed;
 * the same is true of the single long-lived Node process.
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
