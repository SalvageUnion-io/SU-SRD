/**
 * The shared half of the two browser Sentry shims (`apps/itun` and `apps/srd`).
 *
 * This module imports NO Sentry code, deliberately — not even a type. Each app
 * keeps its own `initBrowserObservability`, and the one line that must stay in
 * the app is the DSN guard: each reads its own `import.meta.env` DSN
 * (`VITE_SENTRY_DSN` / `PUBLIC_SENTRY_DSN`), Vite inlines that statically at
 * build, and the resulting `if (!dsn) return` is what makes the app's
 * `import('@sentry/browser')` unreachable, so Rollup drops the SDK entirely
 * from a build with no DSN provisioned. Hoisting the guard into a shared
 * function would take a constant Vite can fold and turn it into a runtime
 * argument it cannot — shipping the SDK to every visitor.
 *
 * Everything AFTER the guard, though, was a near-copy in the two apps (audit
 * AP-12): the idempotent init with its race guard, the errors-only init
 * options, the module handle, and the capture verbs. That lives here now, in
 * {@link createBrowserObservability}, and the app hands it a LOADER rather than
 * the SDK, so the dynamic import still sits behind the app's own guard.
 */

/**
 * Grouping and labelling for a captured event.
 *
 * Both fields exist for the same reason: a Sentry issue is only useful if all
 * the events of one condition land in it and its title says what the condition
 * is. Convex's redacted errors satisfy neither by default — the message is
 * `"[CONVEX M(fn)] [Request ID: 1b66…] Server Error"`, so the request id makes
 * every event's message unique and the rest of it says nothing. In production
 * that produced two separate issues titled with request ids, for one condition,
 * with the actual cause nowhere in either.
 */
export type CaptureOptions = {
  /**
   * Stable grouping key. Overrides Sentry's default fingerprint entirely, so
   * pass the things that identify the *condition* and nothing that varies per
   * event (never a request id, an entity id, or a bundle hash).
   */
  fingerprint?: string[]
  /** Searchable, aggregatable labels. Sentry indexes these; `extra` it does not. */
  tags?: Record<string, string>
}

/** The subset of Sentry's event hint this repo uses. */
export type CaptureHint = {
  extra?: Record<string, unknown>
  tags?: Record<string, string>
  fingerprint?: string[]
}

/**
 * Build the hint object for `Sentry.captureException`, or `undefined` when
 * there is nothing to attach.
 *
 * Spelled out rather than derived from
 * `Parameters<typeof Sentry.captureException>[1]`. That compiles, but it pins
 * the shape to Sentry's `ExclusiveEventHintOrCaptureContext` union — three
 * overlapping shapes whose members are mutually `never` — so the day the SDK
 * reshapes that union the breakage lands here rather than at the call site.
 * These three fields are the whole contract we use; naming them is both clearer
 * and stabler. (Keeping that reasoning is the point of moving this: it was
 * written once, in itun, and the srd copy simply lacked the capability.)
 */
export function buildCaptureHint(
  context?: Record<string, unknown>,
  options?: CaptureOptions
): CaptureHint | undefined {
  const hint: CaptureHint = {}
  if (context) hint.extra = context
  if (options?.tags) hint.tags = options.tags
  if (options?.fingerprint) hint.fingerprint = options.fingerprint
  return Object.keys(hint).length > 0 ? hint : undefined
}

/**
 * The slice of `@sentry/browser`'s namespace this module drives.
 *
 * Structural, so this package needs no dependency on the SDK: the app's
 * `import('@sentry/browser')` satisfies it as-is.
 */
export type BrowserSentrySdk = {
  init(options: BrowserSentryInitOptions): unknown
  captureException(error: unknown, hint?: CaptureHint): unknown
  captureMessage(message: string, hint?: CaptureHint): unknown
}

/** What `init` is called with. Errors only: no tracing, no replay. */
export type BrowserSentryInitOptions = {
  dsn: string
  environment?: string
  release?: string
  tracesSampleRate: number
  ignoreErrors?: string[]
}

/** Per-app settings that do not come from the environment. */
export type BrowserObservabilityConfig = {
  /**
   * Substrings of `${type}: ${value}` to drop before sending. Omitted from the
   * init options entirely when absent, rather than sent as `[]`.
   */
  ignoreErrors?: string[]
  /**
   * Send each error OBJECT at most once. ITUN needs it — a failed chunk load
   * is reported by `chunkRecovery` and then again by the error boundary — and
   * srd has no second reporter, so it leaves this off.
   */
  dedupe?: boolean
}

/** The per-deploy values the app reads from `import.meta.env`. */
export type BrowserInitEnv = {
  dsn: string
  environment?: string
  release?: string
}

export type BrowserObservability = {
  /**
   * Initialise once. Call it only AFTER the app's own `if (!dsn) return`, and
   * pass `() => import('@sentry/browser')` as `load` — see the module header.
   */
  init(load: () => Promise<BrowserSentrySdk>, env: BrowserInitEnv): Promise<void>
  /** Report a caught exception when initialised; otherwise a no-op. */
  captureException(
    error: unknown,
    context?: Record<string, unknown>,
    options?: CaptureOptions
  ): void
  /** Report an informational message when initialised; otherwise a no-op. */
  captureMessage(message: string, context?: Record<string, unknown>): void
}

/**
 * Build one app's browser observability.
 *
 * `init` marks itself initialised BEFORE awaiting the loader, so two callers
 * racing on page load cannot both reach `Sentry.init`. Until the loader
 * resolves, and forever on a build with no DSN, both capture verbs are silent
 * no-ops — capturing is never an error.
 */
export function createBrowserObservability(
  config: BrowserObservabilityConfig = {}
): BrowserObservability {
  let initialized = false
  let sdk: BrowserSentrySdk | null = null
  // A WeakSet, so a reported error is still collectable; primitives cannot be
  // tracked and are always sent.
  const reported = config.dedupe ? new WeakSet<object>() : null

  function alreadyReported(error: unknown): boolean {
    if (!reported || typeof error !== 'object' || error === null) return false
    if (reported.has(error)) return true
    reported.add(error)
    return false
  }

  return {
    async init(load, env) {
      if (initialized) return
      initialized = true

      const loaded = await load()
      sdk = loaded
      const options: BrowserSentryInitOptions = {
        dsn: env.dsn,
        environment: env.environment,
        // Tags events with the deployed commit so an error maps back to a
        // deploy — and must match the release name the Vite plugin uploads
        // sourcemaps under, or the maps silently never apply. `||` so an empty
        // string (unset locally) omits the tag rather than naming a release "".
        release: env.release || undefined,
        // Errors only — no performance tracing or session replay. Keeps network
        // chatter minimal and the CSP surface to the ingest origin.
        tracesSampleRate: 0,
      }
      if (config.ignoreErrors) options.ignoreErrors = config.ignoreErrors
      loaded.init(options)
    },
    captureException(error, context, options) {
      if (!sdk) return
      if (alreadyReported(error)) return
      sdk.captureException(error, buildCaptureHint(context, options))
    },
    captureMessage(message, context) {
      if (!sdk) return
      sdk.captureMessage(message, buildCaptureHint(context))
    },
  }
}
