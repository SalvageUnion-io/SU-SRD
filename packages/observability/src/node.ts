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
 *
 * And THE SDK ITSELF is not here — it is a parameter. This file imports
 * `@sentry/node` for its types only (`import type`, erased at build), so the
 * package contributes no runtime import of it.
 *
 * That is not style; it is what keeps the Netlify Functions bootable. Netlify's
 * bundler (zip-it-and-ship-it) cannot inline `@sentry/node` — the OpenTelemetry
 * layer under it uses dynamic requires — so it externalises the package and
 * copies it into the zip *next to the file the import was resolved from*. When
 * the import lived here, that was `packages/observability/node_modules/`, while
 * the bundled function is emitted at `apps/itun/netlify/functions/*.mjs`. Node
 * resolves from the emitted file upward and never reaches `packages/`, so every
 * snapshot Function died at module load with
 *
 *     Cannot find package '@sentry/node' imported from
 *     /var/task/apps/itun/netlify/functions/snapshot-publish.mjs
 *
 * — a 502 on publish, retrieve AND delete, i.e. sharing entirely down, for a
 * package.json edit that nothing in typecheck, tests, lint or knip could see.
 *
 * With the SDK injected, each consumer's own `import * as Sentry from
 * '@sentry/node'` is what the bundler resolves, so the copy lands under that
 * consumer's `node_modules` and the emitted file can reach it. Consequently
 * **every consumer must declare `@sentry/node` in its own package.json**;
 * `tools/check-observability.ts` asserts that, because production is otherwise
 * the first place you find out.
 */

import type * as SentryNode from '@sentry/node'

/**
 * The slice of the `@sentry/node` API this wiring uses.
 *
 * Derived from the real module type rather than hand-written, so a breaking SDK
 * change fails typecheck here instead of at runtime in a Function.
 */
export type SentrySdk = Pick<
  typeof SentryNode,
  'init' | 'captureException' | 'captureMessage' | 'flush' | 'captureCheckIn'
>

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
  /**
   * What to call this surface in the missing-DSN warning, e.g.
   * `'itun netlify functions'`. Defaults to a generic phrasing.
   */
  surface?: string | undefined
  /**
   * Where the operator should set the DSN, appended to that warning — e.g.
   * `'Netlify site env vars, scoped to Functions'`. Surface-specific, because a
   * warning that does not say where to go is only half an alarm.
   */
  remediation?: string | undefined
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
  /**
   * Start a recurring liveness check-in against a Sentry cron monitor, and
   * return a function that stops it.
   *
   * **This is the primitive a long-lived worker needs, and an error event is
   * not.** The bot used to `captureMessage('discord-bot ready')` on login,
   * reasoning that a gap in those events would reveal a dead worker. It cannot:
   * Sentry alerts on events *arriving*, not on their absence, so the one thing
   * the signal existed to detect was the one thing it could not report. What it
   * did do was mint a permanent error-category issue that had to be archived
   * forever to keep the queue clean — at which point it was no longer a signal
   * at all (issue SU-DISCORD-1, 29 events and climbing).
   *
   * A cron monitor inverts that: Sentry knows the expected cadence, so a
   * *missed* check-in is what raises the alert. The monitor is upserted from
   * `config` on the first check-in, so there is no dashboard step to forget.
   *
   * No-op when disabled, so a DSN-less run starts no timer at all.
   */
  startHeartbeat: (options: HeartbeatOptions) => () => void
}

/** Configuration for {@link Observability.startHeartbeat}. */
export type HeartbeatOptions = {
  /** Monitor slug, e.g. `discord-bot-heartbeat`. Sentry creates it on first use. */
  monitorSlug: string
  /** How often to check in. Must match `schedule` — Sentry judges lateness against the schedule. */
  intervalMs: number
  /**
   * The cadence Sentry should expect, plus its tolerance.
   *
   * Derived from `captureCheckIn`'s own second parameter rather than imported as
   * `MonitorConfig`, which `@sentry/node` does not re-export (it lives in
   * `@sentry/core`) — and taking a direct dependency on core, for one type, is
   * exactly the kind of extra Sentry import that broke the Netlify bundles
   * twice. Same discipline as `SentrySdk` above: tied to the real API, so an SDK
   * change fails typecheck here rather than at runtime in a worker.
   */
  monitorConfig: NonNullable<Parameters<typeof SentryNode.captureCheckIn>[1]>
  /**
   * Asked on every tick: is the surface still doing its job?
   *
   * **Without this the monitor reports the wrong thing.** A bare timer proves
   * only that the process is scheduling callbacks, so a worker that stays up but
   * loses its connection — revoked token, permanent disconnect, a hung shard —
   * keeps checking in `ok` forever. That is precisely the "went dark" case the
   * monitor exists to catch, and it would be the case it hides.
   *
   * Returning false skips the check-in rather than sending `error`: a missed
   * check-in is what the monitor's schedule already understands, and it recovers
   * on its own the moment the predicate goes true again. Defaults to always-alive
   * for a surface with nothing meaningful to ask.
   */
  isAlive?: () => boolean
  /** Injected in tests; defaults to the global timer. */
  setIntervalFn?: typeof setInterval
  /** Injected in tests; defaults to the global timer. */
  clearIntervalFn?: typeof clearInterval
}

/**
 * Says so, on stderr, when a server surface comes up with no DSN.
 *
 * **This is the difference between "no errors" and "no reporting", and nothing
 * else in the system can tell them apart.** `itun-functions` had received zero
 * events in its entire existence — through a 24-hour outage in which all three
 * snapshot Functions 502'd — and zero was indistinguishable from healthy. The
 * outage itself is not proof either way, because both of its causes killed the
 * module at load, so no handler ever ran to report anything.
 *
 * The Discord bot already warned here, in its own copy, while both Netlify
 * surfaces stayed silent. Lifting it into the shared factory is what stops that
 * from being three independent decisions — which is the drift this package
 * exists to prevent, and the exact way the two Netlify shims diverged before it.
 *
 * `console.warn` rather than a throw: a missing DSN must never take down a
 * Function or a worker. Reporting is the thing that is degraded; the surface
 * still has a job to do. It fires once per process (or per cold start), guarded
 * by `initialized` in the caller.
 */
function warnUnconfigured(config: ObservabilityConfig): void {
  const surface = config.surface ?? 'this surface'
  const where = config.remediation ? ` Set SENTRY_DSN in ${config.remediation}.` : ''
  console.warn(
    `[observability] SENTRY_DSN not set — ${surface} is reporting nothing to Sentry.${where} ` +
      'A silent Sentry project is not evidence of a healthy service.'
  )
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
export function createObservability(
  resolve: () => ObservabilityConfig,
  Sentry: SentrySdk
): Observability {
  /**
   * Latches on the first init ATTEMPT, not on the first success — so a surface
   * that came up without a DSN stays off for that process.
   *
   * That is deliberate and asserted (`apps/su-assets/netlify/lib/
   * observability.test.ts`): Netlify Functions call `initObservability()` at the
   * top of every invocation, so the first call of a cold start decides. A DSN
   * cannot appear mid-container in production, and allowing a later init to
   * succeed would let a test file mask a real "we never read the DSN" bug.
   */
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
      if (!config.dsn) {
        // Once per process: `initialized` above already makes this unreachable
        // on a second call, which is what keeps a Function's log readable when
        // every invocation calls init().
        warnUnconfigured(config)
        return false
      }
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

    startHeartbeat(options) {
      if (!enabled) return () => {}

      const setIntervalFn = options.setIntervalFn ?? setInterval
      const clearIntervalFn = options.clearIntervalFn ?? clearInterval

      const checkIn = () => {
        // A failed check-in must not take the worker down with it: this runs on
        // a bare timer, so a throw here is an unhandled rejection in the bot's
        // own crash handler, i.e. the monitor killing the thing it monitors.
        try {
          // Asked EVERY tick, not once at start. A process that is running is
          // not the same as a surface that is working, and only the second is
          // worth reporting — see `isAlive`.
          if (options.isAlive && !options.isAlive()) return
          Sentry.captureCheckIn(
            { monitorSlug: options.monitorSlug, status: 'ok' },
            options.monitorConfig
          )
        } catch {
          // Reporting liveness is strictly less important than being live.
        }
      }

      // Check in immediately as well as on the interval. Without this the
      // monitor's first window is judged before anything has been sent, so a
      // healthy start reads as a missed check-in.
      checkIn()
      const timer = setIntervalFn(checkIn, options.intervalMs)
      // Never let liveness reporting be the reason a process stays alive.
      timer.unref?.()

      return () => clearIntervalFn(timer)
    },
  }
}
