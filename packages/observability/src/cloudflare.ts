/**
 * Sentry wiring for the Cloudflare Workers surfaces.
 *
 * ## Why it imports the SDK directly
 *
 * wrangler bundles with esbuild, which resolves workspace packages normally, so
 * this module imports `@sentry/cloudflare` itself and the three Workers get it
 * through one dependency declared in one place — a runtime `dependency` of this
 * package, not a devDependency (audit PK-07).
 *
 * `@sentry/cloudflare` is built for workerd: it hooks `fetch` through a
 * wrapper instead of installing global instrumentation, and needs the
 * `nodejs_als` compatibility flag, which `tools/check-observability.ts`
 * asserts for every Worker.
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
 * Without it a Worker's errors reach only `console.error`, which lands in
 * Workers Logs — retained for days and alerted on by nothing.
 *
 * ## Tested
 *
 * `__tests__/cloudflare.test.ts` drives the real SDK with `fetch` (its workerd
 * transport) replaced, so it asserts what actually leaves the Worker: with a
 * DSN, escaped and handled errors are sent with the release, environment and
 * server name, and a request body never is; with no DSN, nothing is sent at all.
 *
 * `reportError` writes to `console.error` as well as Sentry: Workers Logs is
 * where you look during a `wrangler tail`, and losing that would trade one blind
 * spot for another. It does both so no caller has to.
 */
import * as Sentry from '@sentry/cloudflare'

/**
 * The environment fields this module reads.
 *
 * Deliberately structural rather than each Worker's full `Env`: this package
 * must not know what bindings any particular Worker has.
 */
export type ObservabilityEnv = {
  /**
   * Absent means Sentry is off — the deliberate default for local dev. Read by
   * the SDK itself, not by this module.
   */
  SENTRY_DSN?: string
  /**
   * Commit SHA, used as the Sentry release — the same SHA the browser bundles
   * and their sourcemaps are tagged with. The deploy workflow passes it as
   * `wrangler deploy --var SENTRY_RELEASE:<sha>`. Read by the SDK itself: it
   * must not be set in the options below, where even an `undefined` value
   * overrides the SDK's own env read.
   */
  SENTRY_RELEASE?: string
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
}

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException?(): void
}

/**
 * Wrap a Worker's default export so unhandled errors reach Sentry.
 *
 * `serverName` is the Worker's wrangler `name`: all three Workers report into
 * the one `workers` Sentry project, and `server_name` is what tells them apart.
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
      environment: env.SENTRY_ENVIRONMENT ?? 'production',
      serverName,
      // No tracing. These Workers are latency-sensitive and the question being
      // answered is "did it throw", not "where did the time go" — and a Free
      // plan's 10 ms CPU budget is not the place to spend on span overhead.
      tracesSampleRate: 0,
      // No PII by default (cookies, IPs, user identity).
      sendDefaultPii: false,
      // Do not send request bodies. The Discord interaction body is a signed
      // payload including user content (and the retired snapshot publish body
      // was a player's sheet); neither belongs in an error report.
      //
      // `sendDefaultPii: false` does NOT achieve this. The SDK's default
      // HttpServer integration captures any textual request body (up to
      // `'medium'`, ~10 KB) regardless of that flag. Supplying our own
      // instance replaces the default one by name — the SDK dedupes
      // integrations and a user-supplied one wins — so this is the only
      // HttpServer integration that runs. The test posts a JSON body with an
      // explicit content-type and asserts it never reaches an envelope.
      integrations: [Sentry.httpServerIntegration({ maxRequestBodySize: 'none' })],
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
 * Both sinks, every time: `console.error` for Workers Logs (what `wrangler tail`
 * shows during an incident) and Sentry (what alerts). Safe to call when Sentry
 * is disabled — `captureException` is a no-op without a DSN — and under Bun,
 * so shared code and its tests import it directly.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error(error, context ?? {})
  Sentry.captureException(error, context ? { extra: context } : undefined)
}
