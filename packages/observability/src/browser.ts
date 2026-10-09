/**
 * The shared half of the two browser Sentry shims (`apps/itun` and `apps/srd`).
 *
 * This module imports NO Sentry code, deliberately — not even a type. Each app
 * keeps its own `initBrowserObservability`, and the one line that must stay in
 * the app is the DSN guard: each reads its own `import.meta.env` DSN
 * (`VITE_SENTRY_DSN`), Vite inlines that statically at
 * build, and the resulting `if (!dsn) return` is what makes the app's
 * `import('@sentry/browser')` unreachable, so Rollup drops the SDK entirely
 * from a build with no DSN provisioned. Hoisting the guard into a shared
 * function would take a constant Vite can fold and turn it into a runtime
 * argument it cannot — shipping the SDK to every visitor.
 *
 * Everything AFTER the guard lives here, in {@link createBrowserObservability}:
 * the idempotent init with its race guard, the errors-only init options, the
 * module handle, the capture verbs and the deploy-skew chunk recovery. The app
 * hands it a LOADER rather than the SDK, so the dynamic import still sits
 * behind the app's own guard.
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
  /**
   * Install the deploy-skew reload guard (see {@link ChunkRecoveryDeps}). Call
   * it once, from the app's client entry, before anything lazy is imported.
   *
   * @returns a teardown that removes the listener (used by tests).
   */
  installChunkRecovery(deps?: ChunkRecoveryDeps): () => void
}

/**
 * sessionStorage key holding the epoch-ms of the last recovery reload.
 *
 * Session-scoped on purpose: the condition is "this tab is running a build the
 * server no longer has", which a new tab does not inherit. One name serves
 * both apps, because sessionStorage is per origin.
 */
const CHUNK_RELOAD_KEY = 'chunk-reload-at'

/**
 * How long a recovery reload suppresses the next one.
 *
 * A cooldown rather than a one-shot flag: a one-shot never rearms, so a second
 * deploy later in the same long-lived tab would go unhandled. A cooldown
 * rearms on its own and still makes a reload loop impossible — if the very
 * next load fails the same way, the error is left to surface instead.
 */
const RELOAD_COOLDOWN_MS = 20_000

/** Vite dispatches this with the failed import's error as `payload`. */
type PreloadErrorEvent = Event & { payload?: unknown }

/**
 * Chunk recovery — survive a deploy that lands while the page is open.
 *
 * Both apps are code-split, and every hashed chunk URL is valid only for the
 * build that emitted it. A page open across a deploy (or served from an older
 * cache) asks for chunk names the server no longer has. A reload is a
 * navigation, which boots current HTML naming current hashes, so the fix is to
 * notice and reload once.
 *
 * Deliberately narrow: it listens for Vite's own `vite:preloadError`, emitted
 * by the `__vitePreload` helper that wraps every dynamic import in the build.
 * A chunk that fails some other way (a `<script>` tag, a plain fetch) is not
 * covered.
 *
 * Every field defaults to the browser's own; tests inject them.
 */
export type ChunkRecoveryDeps = {
  /** Where Vite dispatches `vite:preloadError`. Defaults to `window`. */
  target?: EventTarget
  /** Defaults to `sessionStorage`. */
  storage?: Storage
  /** Defaults to a hard reload. */
  reload?: () => void
  /** Defaults to `Date.now`. */
  now?: () => number
}

/**
 * sessionStorage throws rather than degrading in some privacy modes. Recovery
 * must not depend on it, so both accessors fail soft: a failed read means "no
 * cooldown recorded", which errs toward reloading.
 */
function readLastReloadAt(storage: Storage | undefined): number {
  if (!storage) return 0
  try {
    return Number(storage.getItem(CHUNK_RELOAD_KEY)) || 0
  } catch {
    // Storage denied: no record of a recent reload, so recovery may reload.
    return 0
  }
}

function writeLastReloadAt(storage: Storage | undefined, at: number): void {
  if (!storage) return
  try {
    storage.setItem(CHUNK_RELOAD_KEY, String(at))
  } catch {
    // Non-fatal: we lose the loop guard, not the recovery.
  }
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

  function captureException(
    error: unknown,
    context?: Record<string, unknown>,
    options?: CaptureOptions
  ): void {
    // The SDK's own client drops an error object it has already captured, so
    // a chunk failure seen by both the recovery and an error boundary is one
    // event.
    if (!sdk) return
    sdk.captureException(error, buildCaptureHint(context, options))
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
    captureException,
    captureMessage(message, context) {
      if (!sdk) return
      sdk.captureMessage(message, buildCaptureHint(context))
    },
    installChunkRecovery(deps = {}) {
      // `globalThis` is `window` in a page.
      const target = deps.target ?? globalThis
      const storage: Storage | undefined = deps.storage ?? globalThis.sessionStorage
      const reload = deps.reload ?? (() => globalThis.location.reload())
      const now = deps.now ?? Date.now
      // Per document: once a reload is on its way, every later chunk failure
      // in this page is the same deploy skew. Without it a page that fails
      // several imports at once would report one `recovered: true` and then a
      // `recovered: false` per sibling, for a page that did recover.
      let reloadScheduled = false

      const onPreloadError = (event: Event) => {
        if (reloadScheduled) {
          event.preventDefault()
          return
        }
        const error = (event as PreloadErrorEvent).payload ?? event
        const at = now()
        const since = at - readLastReloadAt(storage)
        const willReload = since >= RELOAD_COOLDOWN_MS

        // Reported either way: a failure that reloads is invisible to the user
        // and would otherwise be invisible to us too. A fixed fingerprint,
        // because the message carries a bundle hash and Sentry's default
        // grouping would mint a new issue per deploy.
        captureException(
          error,
          { recovered: willReload, msSinceLastReload: since },
          { fingerprint: ['chunk-preload-error'], tags: { recovered: String(willReload) } }
        )

        // A second failure inside the cooldown: stop, and let Vite rethrow so
        // the app's error handling shows it rather than looping.
        if (!willReload) return

        reloadScheduled = true
        writeLastReloadAt(storage, at)
        // Suppress Vite's rethrow — this is being handled by reloading.
        event.preventDefault()
        reload()
      }

      target.addEventListener('vite:preloadError', onPreloadError)
      return () => {
        target.removeEventListener('vite:preloadError', onPreloadError)
      }
    },
  }
}
