/**
 * The shared half of the two browser apps' error reporting (the reference site and the
 * App, both in `apps/web`).
 *
 * Cloudflare has no browser error tracking, so each app posts its errors to its
 * own Worker, at `ERROR_REPORT_PATH` under the app's base. The Worker
 * (`handleErrorReport` in `src/worker/errorReports.ts`) logs each one as an
 * `Error`, and Workers Issues groups it with the Worker's own.
 *
 * What this reports:
 *
 * - **Uncaught errors and unhandled rejections**, through the window's own
 *   `error` and `unhandledrejection` events, once `init` has run.
 * - **Caught errors**, through {@link BrowserObservability.captureException}.
 *   Catching is exactly what keeps an error away from those window events, so
 *   every deliberately-caught error is reported through it.
 * - **Chunk failures**, through `installChunkRecovery`.
 *
 * It never throws and never retries: a report that cannot be sent is dropped.
 * At most {@link MAX_REPORTS_PER_PAGE} leave one page, so a render loop cannot
 * flood the endpoint, and an error object is reported once however many
 * handlers see it.
 */

import type { ErrorReport } from '../worker/errorReports'
import { ERROR_REPORT_PATH } from '../worker/errorReports'

export type { ErrorReport }
export { ERROR_REPORT_PATH }

/**
 * Grouping and labelling for a captured event.
 *
 * `fingerprint` groups events whose message varies per event (a request id,
 * an entity id): grouped by message, one condition becomes one issue per event.
 */
type CaptureOptions = {
  /**
   * Stable name for the condition. The Worker logs the error under it instead
   * of the message, so pass the things that identify the *condition* and
   * nothing that varies per event (never a request id, an entity id, or a
   * bundle hash).
   */
  fingerprint?: string[]
  /** Short labels, logged with the event. */
  tags?: Record<string, string>
}

/** Per-app settings that do not come from the environment. */
export type BrowserObservabilityConfig = {
  /**
   * Substrings of `${name}: ${message}` to drop before sending. Browser noise
   * that is not the app's to fix.
   */
  ignoreErrors?: string[]
  /**
   * How a report leaves the page. Defaults to `navigator.sendBeacon`, falling
   * back to a `keepalive` fetch; tests inject one.
   */
  transport?: (endpoint: string, body: string) => void
}

/** What `init` is called with, from the app's `import.meta.env`. */
type BrowserInitEnv = {
  /** The app's report endpoint: its base plus `ERROR_REPORT_PATH`. */
  endpoint: string
  /** The deployed commit, `VITE_COMMIT_REF`. */
  release?: string
  /** Where the window events are heard. Defaults to `window`; tests inject one. */
  target?: EventTarget
}

export type BrowserObservability = {
  /**
   * Start reporting, once; later calls are no-ops.
   *
   * @returns a teardown that stops reporting and removes the listeners (used
   * by tests, so a module-level instance does not outlive its test file).
   */
  init(env: BrowserInitEnv): () => void
  /** Report a caught exception when initialised; otherwise a no-op. */
  captureException(
    error: unknown,
    context?: Record<string, unknown>,
    options?: CaptureOptions
  ): void
  /**
   * Install the deploy-skew reload guard (see {@link ChunkRecoveryDeps}). Call
   * it once, from the app's client entry, before anything lazy is imported.
   *
   * @returns a teardown that removes the listener (used by tests).
   */
  installChunkRecovery(deps?: ChunkRecoveryDeps): () => void
}

/** The most reports one page sends. */
export const MAX_REPORTS_PER_PAGE = 20

/**
 * The browser abandoning a cross-document view transition: noise that is not
 * the app's to fix, for an app's `ignoreErrors`.
 *
 * A same-origin navigation can run a cross-document view transition (the reference site opts
 * in with `@view-transition { navigation: auto }`; a page that does not opt in
 * still receives the one the reference site started). The promises that transition exposes
 * belong to the **user agent**, so there is no JS handle to `.catch()`: when
 * the browser abandons a transition it rejects one of them and the
 * `unhandledrejection` handler hears it. The navigation itself completes
 * normally either way. Three messages, one mechanism:
 *
 * - **`Transition was skipped`**: a second navigation superseded an in-flight
 *   transition (Chrome's wording).
 * - **`Skipping view transition`**: the same, worded `Skipping view transition
 *   because skipTransition() was called.` by WebKit and the iOS in-app
 *   browsers. The `skipTransition()` call is the browser's own.
 * - **`Transition was aborted because of invalid state`**: the document was
 *   made ineligible mid-transition, by being hidden, or (`ViewTransition
 *   opt-in disabled`) by being a page that does not opt in, as the app
 *   does not when the SRD's header links into it. An `InvalidStateError`, so
 *   only the message identifies it.
 *
 * Matched as substrings of `${name}: ${message}`.
 */
export const ABANDONED_VIEW_TRANSITIONS = [
  'Transition was skipped',
  'Skipping view transition',
  'Transition was aborted because of invalid state',
]

/**
 * Noise every app drops, on top of its own `ignoreErrors`.
 *
 * - **`ResizeObserver loop`**: a `ResizeObserver` callback changed layout, so
 *   the browser deferred the rest of its notifications to the next frame and
 *   says so on the window's `error` event (Chrome: `ResizeObserver loop
 *   completed with undelivered notifications.`; older: `ResizeObserver loop
 *   limit exceeded`). The spec's own loop guard, not a failure: nothing is
 *   lost, and the event carries no error object, which is why it arrives as a
 *   `NonError`. Raised by the browser for observers the app does not own
 *   (React libraries, in-app browsers' WebViews) as readily as for its own.
 * - **`Script error.`**: an error thrown by a cross-origin script, which the
 *   browser masks down to these two words with no stack, file or line. The
 *   app's own scripts are same-origin, so it is never theirs, and there is
 *   nothing in it to act on.
 * - **`__gCrWeb`**: Chrome on iOS's own injected script, reached for in a
 *   frame it was not injected into (`Can't find variable: __gCrWeb`).
 * - **`window.ethereum`**: Brave's built-in wallet on iOS runs
 *   `window.ethereum.selectedAddress = undefined` as an inline script in every
 *   page, and it throws where the wallet object is missing. Its stack names
 *   only the page itself (`global code@https://salvageunion.io/:1:16`), so the
 *   extension check below cannot see it. The app never reads `window.ethereum`.
 * - **`__firefox__`**: Brave on iOS is built on Firefox for iOS and injects
 *   its helpers (reader mode and the rest) the same way, under
 *   `window.__firefox__`; where that object is missing they throw
 *   (`Can't find variable: __firefox__`, `undefined is not an object
 *   (evaluating 'window.__firefox__.reader')`), with the same page-only stack.
 *   The app never reads it.
 *
 * Matched as substrings of `${name}: ${message}`.
 */
const BROWSER_NOISE = [
  'ResizeObserver loop',
  'NonError: Script error.',
  '__gCrWeb',
  'window.ethereum.selectedAddress',
  '__firefox__',
]

/**
 * The URL schemes a browser extension's own scripts run under (Chromium,
 * Firefox, Safari).
 *
 * An extension's content script runs in the page, so its errors reach the
 * window's `error` and `unhandledrejection` events like the app's own: a
 * wallet extension's injected script failing to reach its background page
 * (`Failed to connect to MetaMask`) is the common one. Not the app's to fix.
 */
const EXTENSION_SCHEMES = ['chrome-extension://', 'moz-extension://', 'safari-web-extension://']

/**
 * Whether a stack is wholly an extension's: it names an extension script and
 * no page script. An error that passes through the app's code on its way is
 * kept, since that code may be the thing to fix.
 */
function isExtensionStack(stack: string | undefined): boolean {
  if (!stack) return false
  const urls = stack.match(/[a-z-]+:\/\/[^\s)]+/g) ?? []
  return (
    urls.some((url) => EXTENSION_SCHEMES.some((scheme) => url.startsWith(scheme))) &&
    urls.every((url) => EXTENSION_SCHEMES.some((scheme) => url.startsWith(scheme)))
  )
}

/** Long enough for any real message and a deep minified stack; the Worker reads 16 KB. */
const MAX_MESSAGE_CHARS = 1_000
const MAX_STACK_CHARS = 8_000
const MAX_CONTEXT_CHARS = 2_000

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** Name, message and stack of anything thrown, an `Error` or not. */
function describe(error: unknown): Pick<ErrorReport, 'name' | 'message' | 'stack'> {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: clip(error.message, MAX_MESSAGE_CHARS),
      stack: error.stack ? clip(error.stack, MAX_STACK_CHARS) : undefined,
    }
  }
  let message: string
  try {
    message = typeof error === 'string' ? error : (JSON.stringify(error) ?? String(error))
  } catch {
    // A cycle or a BigInt: its string form will do.
    message = String(error)
  }
  return { name: 'NonError', message: clip(message, MAX_MESSAGE_CHARS) }
}

/** The context, when it serialises within its budget; otherwise a note saying why not. */
function boundedContext(
  context: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!context) return undefined
  try {
    const json = JSON.stringify(context)
    if (json.length <= MAX_CONTEXT_CHARS) return context
    return { truncated: clip(json, MAX_CONTEXT_CHARS) }
  } catch {
    // A cycle in the context: the error is still worth sending without it.
    return { unserialisable: true }
  }
}

/** The page, without its query or hash: those can carry what is not ours to log. */
function currentPage(): string | undefined {
  const location = (globalThis as { location?: Location }).location
  return location ? `${location.origin}${location.pathname}` : undefined
}

function beacon(endpoint: string, body: string): void {
  const nav = (globalThis as { navigator?: Navigator }).navigator
  if (nav?.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) return
  void fetch(endpoint, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    keepalive: true,
  }).catch(() => {
    // Reporting must never become the error: a report that fails is dropped.
  })
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
type ChunkRecoveryDeps = {
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
 * Build one app's browser observability. Until `init`, and forever in a build
 * that never calls it, `captureException` is a silent no-op — capturing is
 * never an error.
 */
export function createBrowserObservability(
  config: BrowserObservabilityConfig = {}
): BrowserObservability {
  const transport = config.transport ?? beacon
  const ignored = [...BROWSER_NOISE, ...(config.ignoreErrors ?? [])]
  let endpoint: string | null = null
  let release: string | undefined
  let sent = 0
  // Set by `installChunkRecovery` once a recovery reload is on its way. Every
  // error this page raises after that is the same deploy skew: the Cantina's
  // router, given a lazy route whose chunk failed, renders it with no
  // component and its boundary catches `reading 'component'`. The reload
  // replaces the page, so none of it is worth a report.
  let reloadScheduled = false
  // An error seen by two handlers (a chunk failure, then its boundary) is one report.
  const reported = new WeakSet<object>()

  function captureException(
    error: unknown,
    context?: Record<string, unknown>,
    options?: CaptureOptions
  ): void {
    if (endpoint === null || reloadScheduled || sent >= MAX_REPORTS_PER_PAGE) return
    if (typeof error === 'object' && error !== null) {
      if (reported.has(error)) return
      reported.add(error)
    }
    const described = describe(error)
    const label = `${described.name}: ${described.message}`
    if (ignored.some((fragment) => label.includes(fragment))) return
    if (isExtensionStack(described.stack)) return

    const report: ErrorReport = {
      ...described,
      url: currentPage(),
      release,
      context: boundedContext(context),
      tags: options?.tags,
      fingerprint: options?.fingerprint,
    }
    sent += 1
    try {
      transport(endpoint, JSON.stringify(report))
    } catch {
      // Reporting must never become the error: a report that fails is dropped.
    }
  }

  return {
    init(env) {
      if (endpoint !== null) return () => undefined
      endpoint = env.endpoint
      // `||` so an empty string (unset locally) omits the release rather than naming one "".
      release = env.release || undefined
      const target = env.target ?? globalThis
      const onError = (event: Event) => {
        const { error, message } = event as ErrorEvent
        captureException(error ?? message, undefined, { tags: { handler: 'error' } })
      }
      const onRejection = (event: Event) => {
        captureException((event as PromiseRejectionEvent).reason, undefined, {
          tags: { handler: 'unhandledrejection' },
        })
      }
      target.addEventListener('error', onError)
      target.addEventListener('unhandledrejection', onRejection)
      return () => {
        target.removeEventListener('error', onError)
        target.removeEventListener('unhandledrejection', onRejection)
        endpoint = null
      }
    },
    captureException,
    installChunkRecovery(deps = {}) {
      // `globalThis` is `window` in a page.
      const target = deps.target ?? globalThis
      const storage: Storage | undefined = deps.storage ?? globalThis.sessionStorage
      const reload = deps.reload ?? (() => globalThis.location.reload())
      const now = deps.now ?? Date.now
      // Per document (`reloadScheduled`, above): once a reload is on its way,
      // every later chunk failure in this page is the same deploy skew.
      // Without it a page that fails several imports at once would report one
      // `recovered: true` and then a `recovered: false` per sibling, for a page
      // that did recover.

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
        // because the message carries a bundle hash and grouping by it
        // would mint a new issue per deploy.
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
