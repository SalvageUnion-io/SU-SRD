/**
 * Server-side Sentry wiring, shared by every Node surface in the repo.
 *
 * ## Why this package exists
 *
 * `captureException` had five implementations and `initObservability` three.
 * Two of those — `apps/itun/netlify/functions/_observability.ts` and
 * `apps/su-assets/netlify/functions/_observability.ts` — were byte-identical,
 * and one of them said so in prose: *"Mirrors apps/itun/… exactly … there is no
 * reason for the two to drift."* They had already drifted: the itun copy
 * carried a COMMIT_REF-at-runtime caveat the other lacked.
 *
 * It lives in its own package rather than in `component-lib` because the
 * consumers are Netlify Functions and a Discord bot — putting a Sentry
 * dependency into the React component library to serve them would be worse than
 * the duplication.
 *
 * ## Why a factory rather than module-level state
 *
 * The three consumers are three separate processes with different lifecycles (a
 * Netlify Function cold start, a second Function on a different site, a
 * long-lived Render worker). A module-level `let enabled` would be shared state
 * keyed to whichever imported first. `createObservability` gives each surface
 * its own instance, which is also what makes it testable without resetting
 * module registry state.
 *
 * ## What is deliberately NOT here
 *
 * The BROWSER shims (`apps/itun/src/lib/observability.ts`,
 * `apps/srd/src/lib/observability.ts`) stay app-local. They read
 * `import.meta.env.VITE_SENTRY_DSN` / `PUBLIC_SENTRY_DSN`, which Vite inlines
 * STATICALLY at build; that static falsiness is what makes the
 * `@sentry/browser` dynamic import unreachable and lets Rollup drop the SDK
 * from the bundle entirely when no DSN is provisioned. Moving the guard behind
 * a function parameter would make the import unconditionally reachable and ship
 * the SDK to every visitor. The part of them that genuinely duplicated — the
 * capture-hint construction — is shared from `./browser`, which imports no
 * Sentry code at all.
 */

import * as Sentry from '@sentry/node'

export type ObservabilityConfig = {
  /** The Sentry DSN. When absent, every method is a no-op and no SDK call is made. */
  dsn: string | undefined
  /** Deploy environment, e.g. `production`. */
  environment?: string | undefined
  /**
   * Commit SHA the events are tagged with, so an error maps back to one deploy.
   * Netlify supplies `COMMIT_REF`, Render supplies `RENDER_GIT_COMMIT`.
   * Undefined simply omits the tag.
   */
  release?: string | undefined
}

export type Observability = {
  /** True once `init()` has run AND a DSN was present. */
  readonly enabled: boolean
  /** Initialise once. Idempotent; returns whether tracking is now on. */
  init: () => boolean
  captureException: (error: unknown, context?: Record<string, unknown>) => void
  captureMessage: (message: string, context?: Record<string, unknown>) => void
  /**
   * Flush buffered events before the process exits.
   *
   * The transport is async, so a synchronous `process.exit()` straight after
   * `captureException` drops the one event you most need — the crash the host
   * is restarting for. Resolves after the flush or the timeout; never rejects.
   */
  flush: (timeoutMs?: number) => Promise<void>
}

/**
 * `resolve` is a THUNK, not a value, and that is load-bearing: it is called at
 * `init()`, never at import.
 *
 * Every consumer's configuration comes from somewhere that must not be read at
 * module scope — `process.env` in a Netlify Function (a cold start may set it
 * after the module graph loads) and a mockable `config` module in the bot,
 * whose tests swap the DSN per case. The first draft of this took a plain
 * object and captured the DSN at import; the bot's suite caught it immediately,
 * because every test then saw whatever the DSN was when the module first
 * loaded.
 */
export function createObservability(resolve: () => ObservabilityConfig): Observability {
  let initialized = false
  let enabled = false

  return {
    get enabled() {
      return enabled
    },

    init() {
      if (initialized) return enabled
      initialized = true
      const config = resolve()
      if (!config.dsn) return false
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment ?? 'production',
        release: config.release,
      })
      enabled = true
      return true
    },

    captureException(error, context) {
      if (!enabled) return
      Sentry.captureException(error, context ? { extra: context } : undefined)
    },

    captureMessage(message, context) {
      if (!enabled) return
      Sentry.captureMessage(message, context ? { extra: context } : undefined)
    },

    async flush(timeoutMs = 2000) {
      if (!enabled) return
      try {
        await Sentry.flush(timeoutMs)
      } catch {
        // Exiting anyway — nothing useful to do with a flush failure.
      }
    },
  }
}
