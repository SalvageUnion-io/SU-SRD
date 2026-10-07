/**
 * ADR (inline) — chose vite-plugin-pwa over hand-written SW
 *
 * Decision: use vite-plugin-pwa (via workbox) for app-shell caching.
 *
 * Rationale:
 *   - vite-plugin-pwa generates the SW + web manifest from Vite's build
 *     output automatically, so the precache list stays in sync with every
 *     bundle Vite emits. A hand-written SW would need manual maintenance of
 *     every emitted filename (content-hashed), which drifts silently.
 *   - Wraps workbox under the hood — precaching plus per-route strategies.
 *     Which strategy answers a navigation (network first, precached shell
 *     offline) is `workbox.ts`.
 *   - The plugin also auto-injects registration into the built index.html,
 *     but this file provides an explicit registration call so the boot
 *     sequence is visible in main.tsx rather than hidden in injected HTML.
 *     Both register `/sw.js` at scope `/`, which the spec makes idempotent —
 *     they resolve to the same ServiceWorkerRegistration, so the update
 *     listener below sees every update regardless of which call created it.
 *   - Hand-written SW alternative would require: manual glob patterns,
 *     cache versioning, skipWaiting/clientsClaim logic — all solved by
 *     workbox already.
 *
 * Trade-offs accepted:
 *   - SW is skipped in DEV mode so HMR works correctly (see guard below).
 *   - We register `/sw.js` directly (the workbox output filename from
 *     vite-plugin-pwa) rather than importing `virtual:pwa-register`, because
 *     the virtual module only resolves in Vite's build context and cannot be
 *     mocked in Bun's test runner without modifying bunfig.toml.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A PROMPT AND NOT A SILENT AUTO-UPDATE
 *
 * This file used to say `registerType: 'autoUpdate'` "silently swaps in new SW
 * versions on next page load, appropriate for a local-first app". That was the
 * bug. Under `autoUpdate` the plugin forces `skipWaiting` + `clientsClaim`, so
 * a newly-installed worker activated immediately, claimed the page the user was
 * already looking at, and ran `cleanupOutdatedCaches()` — destroying the
 * precache that page was still resolving its code-split chunks against. Every
 * subsequent lazy import asked for a hash the server no longer served. Share
 * links (then `/s/:id`, now `/p/:kind/:appId`) took it worst, because they are opened
 * cold from a link on a device whose worker is whatever build it last saw.
 *
 * `vite.config.ts` is now `registerType: 'prompt'`, which emits a worker that
 * installs and WAITS. Nothing is swapped under a live page. The update lands
 * when the user accepts here (post `SKIP_WAITING`, then reload on
 * `controllerchange`) or when every tab has closed.
 *
 * ---------------------------------------------------------------------------
 * WHEN TO ASK, NOW THAT NAVIGATIONS ARE NETWORK-FIRST
 *
 * `workbox.ts` sends every navigation to the network, so a page load already
 * boots the deployed build; the waiting worker only brings the precache up to
 * date. That changes who the toast is for:
 *
 *   - A page loaded after the deploy is ALREADY the new version. The browser's
 *     own update check on that navigation installs the matching worker, and
 *     toasting "a new version is ready" there would be false — and it would
 *     happen to every returning visitor after every deploy. `onlyWhenStale`
 *     asks the server's current shell first and stays quiet when this page
 *     boots the same entry chunk.
 *   - A tab that stays open across a deploy — and an installed PWA that is
 *     never closed — is the one actually running an old build. No navigation
 *     happens in a SPA, so nothing would ever look for the update.
 *     `keepCheckingForUpdates` asks on registration, whenever the tab becomes
 *     visible, and hourly while it stays visible; when the new worker
 *     installs, this tab is older than the server and gets the toast.
 */

import { captureException } from '../observability'

/** Signature of the "an update is ready" notifier supplied by the caller. */
export type UpdateReadyNotifier = (accept: () => void) => void

export type RegisterOptions = {
  /**
   * Invoked when a new worker has finished installing and is waiting. Receives
   * the accept callback — call it to activate the update and reload.
   *
   * Defaults to a no-op so that callers which do not care (and the tests) need
   * not supply one. main.tsx passes the toast; keeping the UI out of this
   * module is what lets the update logic be tested without a DOM toaster.
   */
  onUpdateReady?: UpdateReadyNotifier
  /**
   * The path of the chunk this page booted from — main.tsx passes
   * `new URL(import.meta.url).pathname`. Its content hash names the build, so
   * finding it in the server's current shell means this page is up to date and
   * an update needs no toast (see `onlyWhenStale`). Omitted, every ready update
   * is announced.
   */
  entryChunk?: string
}

/** How often a visible tab asks the server whether a new build exists. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * The floor between two update checks. `visibilitychange` fires on every tab
 * switch, and each check is a request for `sw.js` that the Worker answers — on
 * a plan that counts requests. A minute is far shorter than any deploy cycle.
 */
const MIN_CHECK_GAP_MS = 60 * 1000

/**
 * The document fetched to learn what the server boots now.
 *
 * `/`, because it is the shell a reload or a new tab would get. The query
 * string keeps it off every service-worker route — the precache route's
 * `/` → `index.html` mapping included, in a worker built before
 * `directoryIndex: null` — so the answer is the network's, not the cache's.
 * The Worker serves `/` for it like any other request; assets ignore the query.
 */
const SHELL_PROBE = '/?sw-shell-probe'

/**
 * Guards against a double reload: `controllerchange` can fire more than once
 * (notably if the user accepts in two tabs at nearly the same moment), and a
 * second reload mid-navigation is user-visible jank.
 */
let reloading = false

/**
 * Activates a waiting worker and reloads once it has taken control.
 *
 * The reload is driven by `controllerchange` rather than fired straight after
 * `postMessage` because `skipWaiting()` is asynchronous: reloading immediately
 * races the activation and can land back on the OLD worker, which presents as
 * "I clicked reload and nothing changed".
 */
function activateWaitingWorker(
  registration: Pick<ServiceWorkerRegistration, 'waiting'>,
  container: Pick<ServiceWorkerContainer, 'addEventListener'>,
  reload: () => void
): void {
  const waiting = registration.waiting
  if (!waiting) {
    // Nothing waiting after all (it may have activated on its own because the
    // last controlled tab closed). A plain reload still gets the new build.
    reload()
    return
  }

  container.addEventListener(
    'controllerchange',
    () => {
      if (reloading) return
      reloading = true
      reload()
    },
    { once: true }
  )

  waiting.postMessage({ type: 'SKIP_WAITING' })
}

/**
 * Watches a registration for an update that is ready to activate.
 *
 * Exported for tests — it takes only the slice of the SW API it uses, so a
 * plain object stands in for a real registration.
 *
 * The `controller` check is what separates an UPDATE from a FIRST INSTALL. On a
 * first visit a worker also reaches `installed`, but there is no controller yet
 * and nothing stale on screen, so prompting would be nonsense ("a new version
 * is available" on a page that just loaded that version).
 */
export function watchForUpdate(
  registration: Pick<ServiceWorkerRegistration, 'waiting' | 'installing' | 'addEventListener'>,
  container: Pick<ServiceWorkerContainer, 'addEventListener' | 'controller'>,
  notify: UpdateReadyNotifier,
  reload: () => void
): void {
  const accept = () => {
    activateWaitingWorker(registration, container, reload)
  }

  // Already waiting at registration time: a previous visit installed it but the
  // page was never reloaded, so no `updatefound` will fire for it now.
  if (registration.waiting && container.controller) {
    notify(accept)
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing
    if (!installing) return

    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && container.controller) {
        notify(accept)
      }
    })
  })
}

/**
 * Does the server now boot a different build from the one this page is running?
 *
 * Read off the server's current shell: this page is current when that shell
 * references the same content-hashed entry chunk. Any failure — offline, a
 * non-2xx, a blocked fetch — answers `true`, because the safe default when we
 * cannot tell is the old behaviour: show the toast and let the user decide.
 */
export async function shellIsStale(
  entryChunk: string,
  fetchShell: () => Promise<Response> = () => fetch(SHELL_PROBE, { cache: 'no-store' })
): Promise<boolean> {
  try {
    const response = await fetchShell()
    if (!response.ok) return true
    return !(await response.text()).includes(entryChunk)
  } catch {
    // Unreachable server: staleness unknown, so answer "stale" and let the
    // toast offer the update — the behaviour before this check existed.
    return true
  }
}

/**
 * Wraps a notifier so it fires only for a page older than the server's build.
 *
 * A page that is already current gets no toast; its waiting worker activates
 * when every tab closes, exactly as before. Nothing here activates a worker —
 * skipping the wait under a live tab is the outage `vite.config.ts` describes,
 * and another open tab may still be on an older build.
 */
export function onlyWhenStale(
  notify: UpdateReadyNotifier,
  isStale: () => Promise<boolean>
): UpdateReadyNotifier {
  return (accept) => {
    void isStale().then((stale) => {
      if (stale) notify(accept)
    })
  }
}

/**
 * Asks the browser to look for a new worker: once now, whenever the document
 * becomes visible, and every `UPDATE_CHECK_INTERVAL_MS` while it is visible.
 *
 * The browser checks by itself on every navigation, which a SPA almost never
 * makes — so without this, a long-lived tab or an installed PWA only ever
 * learned of a deploy on its next cold start. An update found here reaches the
 * toast through `watchForUpdate`'s `updatefound` listener.
 *
 * Exported for tests; takes only the slices of the registration and document
 * it uses. Returns a teardown.
 */
export function keepCheckingForUpdates(
  registration: Pick<ServiceWorkerRegistration, 'update'>,
  doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>,
  {
    now = Date.now,
    every = (tick: () => void, ms: number) => {
      const id = setInterval(tick, ms)
      return () => clearInterval(id)
    },
  }: {
    now?: () => number
    every?: (tick: () => void, ms: number) => () => void
  } = {}
): () => void {
  let lastCheckAt = Number.NEGATIVE_INFINITY

  const check = () => {
    const at = now()
    if (at - lastCheckAt < MIN_CHECK_GAP_MS) return
    lastCheckAt = at
    registration.update().catch(() => {
      // Expected, so not reported: `update()` rejects whenever the network
      // does (offline, a captive portal, a Worker blip), and the next check —
      // the next time the tab is shown, or the next hour — simply tries again.
    })
  }

  const checkIfVisible = () => {
    if (doc.visibilityState === 'visible') check()
  }

  check()
  doc.addEventListener('visibilitychange', checkIfVisible)
  const stopTimer = every(checkIfVisible, UPDATE_CHECK_INTERVAL_MS)

  return () => {
    stopTimer()
    doc.removeEventListener('visibilitychange', checkIfVisible)
  }
}

export function registerServiceWorker(options: RegisterOptions = {}): void {
  const { onUpdateReady = () => undefined, entryChunk } = options

  if (import.meta.env.DEV) {
    // Skip SW registration in development so Vite HMR is not disrupted.
    return
  }

  // Check both key existence and value truthiness: happy-dom and some
  // older browser stubs set `navigator.serviceWorker = undefined`.
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker) {
    return
  }

  const container = navigator.serviceWorker

  container
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      const notify = entryChunk
        ? onlyWhenStale(onUpdateReady, () => shellIsStale(entryChunk))
        : onUpdateReady
      watchForUpdate(registration, container, notify, () => {
        window.location.reload()
      })
      keepCheckingForUpdates(registration, document)
    })
    .catch((error: unknown) => {
      // Previously `void`-ed with no catch, which surfaced in Sentry as two
      // untitled "Error: Rejected" issues via the unhandled-rejection handler.
      // Registration failing is not fatal — the app runs fine uncached — but it
      // should be legible rather than anonymous.
      captureException(
        error,
        { stage: 'serviceWorker.register' },
        {
          fingerprint: ['sw-register-failed'],
        }
      )
    })
}
