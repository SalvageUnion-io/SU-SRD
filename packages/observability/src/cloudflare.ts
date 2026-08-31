/**
 * Sentry wiring for the Cloudflare Workers surfaces.
 *
 * ## Why this is separate from `./node`
 *
 * `./node` takes the SDK as a parameter because Netlify's bundler cannot inline
 * `@sentry/node` — see that file's header. None of that applies here: wrangler
 * bundles with esbuild, which resolves workspace packages normally, so this
 * module imports `@sentry/cloudflare` directly and the Workers get it through
 * one dependency declared in one place.
 *
 * The runtimes are also genuinely different. `@sentry/node` pulls an
 * OpenTelemetry layer that workerd cannot run; `@sentry/cloudflare` is built for
 * workerd and hooks `fetch`/`scheduled` through a wrapper instead of installing
 * global instrumentation.
 *
 * ## Why a wrapper and not `Sentry.init()`
 *
 * ADR-033 is explicit that **module scope on Workers forbids timers, async I/O
 * and randomness**, and says this "also applies to any module-scope
 * observability initialisation". A top-level `Sentry.init()` is exactly the
 * thing that breaks — at startup, not at build.
 *
 * `withSentry` exists for that constraint: it takes a function from `env` to
 * options and evaluates it per request, inside the request context, where the
 * DSN is available and I/O is legal. It also wires `waitUntil` for event
 * flushing, which a hand-rolled `captureException` in a Worker cannot do —
 * without it the isolate can be torn down before the event leaves.
 *
 * ## What the Workers had before
 *
 * A bare `console.error` in each of the three. Those land in Workers Logs, which
 * nothing alerts on and which retains for days, so every production surface was
 * dark to the alerting this repo believes it has — while
 * `tools/check-observability.ts` gated only the two BROWSER apps' CSP and two
 * now-retired Netlify function directories.
 *
 * `console.error` is kept alongside Sentry rather than replaced: Workers Logs is
 * where you look during a `wrangler tail`, and losing that would trade one blind
 * spot for another.
 */
import * as Sentry from '@sentry/cloudflare'

/**
 * The environment fields this module reads.
 *
 * Deliberately structural rather than each Worker's full `Env`: this package
 * must not know what bindings any particular Worker has.
 */
export type ObservabilityEnv = {
  /** Absent means Sentry is off — the deliberate default for local dev. */
  SENTRY_DSN?: string
  /** Commit SHA, used as the Sentry release. Absent means "unreleased". */
  COMMIT_REF?: string
  /** `production` unless set otherwise. */
  SENTRY_ENVIRONMENT?: string
}

/**
 * A Worker's default export, as much of it as this wrapper needs.
 *
 * `ctx` is optional so the Workers' own routing tests can call `fetch(req, env)`
 * with two arguments. workerd always supplies it; every consumer null-guards its
 * use, so a missing ctx costs a deferred cache write, not correctness.
 */
type ExportedHandler<E> = {
  fetch(request: Request, env: E, ctx?: ExecutionContext): Promise<Response> | Response
  /**
   * Cron Trigger entry point. Optional — only the Discord bot has one.
   *
   * `withSentry` wraps this alongside `fetch`, so a throw inside a scheduled
   * run becomes an event too. That matters more here than for `fetch`: nobody
   * is watching a cron run, so an unreported throw there is silent by
   * definition.
   */
  scheduled?(event: unknown, env: E, ctx: ExecutionContext): Promise<void> | void
}

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException?(): void
}

/**
 * Wrap a Worker's default export so unhandled errors reach Sentry.
 *
 * `serverName` names the surface in Sentry, since all three Workers report into
 * the same account and "an error in a Worker" is not actionable on its own.
 *
 * With no `SENTRY_DSN` the SDK initialises disabled: the Worker runs exactly as
 * before and events go nowhere. That is the same env-gated shape the browser
 * shims use, and it is what keeps `wrangler dev` and the tests free of Sentry.
 */
export function withObservability<E extends ObservabilityEnv>(
  serverName: string,
  handler: ExportedHandler<E>
): ExportedHandler<E> {
  return Sentry.withSentry(
    (env: E) => ({
      dsn: env.SENTRY_DSN,
      release: env.COMMIT_REF,
      environment: env.SENTRY_ENVIRONMENT ?? 'production',
      serverName,
      // No tracing. These Workers are latency-sensitive and the question being
      // answered is "did it throw", not "where did the time go" — and a Free
      // plan's 10 ms CPU budget is not the place to spend on span overhead.
      tracesSampleRate: 0,
      // Do not send request bodies. The snapshot publish body is a player's
      // sheet, and the Discord interaction body is a signed payload including
      // user content; neither belongs in an error report.
      sendDefaultPii: false,
    }),
    handler
  ) as ExportedHandler<E>
}

/**
 * Report a handled error — one the Worker caught and turned into a response.
 *
 * `withObservability` only sees what escapes the handler, and these Workers
 * deliberately catch nearly everything (a storage failure becomes a 503, a
 * transformation failure becomes a 404). Those are the events actually worth
 * alerting on, so they have to be reported explicitly.
 *
 * Safe to call when Sentry is disabled: `captureException` is a no-op without a
 * DSN, so callers need no guard of their own.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

/**
 * Open a Sentry cron check-in. Returns the id the close call needs.
 *
 * ## Why a check-in rather than an event
 *
 * Sentry alerts on events ARRIVING, never on their absence. That is why the
 * Discord bot's original `ready` info event could not serve as a liveness
 * signal — the silence that meant "the process went dark" raised nothing. A
 * cron monitor inverts it: a missed check-in is the alarm.
 *
 * ## Why two functions rather than one
 *
 * Sentry's `CheckIn` is a discriminated union — an in-progress check-in carries
 * no id and a finished one requires one — so a single call taking every status
 * cannot be typed honestly. Splitting it also makes the two-phase protocol
 * impossible to half-use: reporting only on success would build a monitor that
 * cannot tell "failed" from "never ran".
 *
 * Exposed from here rather than importing `@sentry/cloudflare` in each Worker,
 * for the same reason `reportError` is: the SDK is this package's dependency.
 */
export function startCheckIn(monitorSlug: string): string {
  return Sentry.captureCheckIn({ monitorSlug, status: 'in_progress' })
}

/** Close a check-in opened by {@link startCheckIn}. */
export function finishCheckIn(
  monitorSlug: string,
  checkInId: string,
  status: 'ok' | 'error'
): void {
  Sentry.captureCheckIn({ checkInId, monitorSlug, status })
}
