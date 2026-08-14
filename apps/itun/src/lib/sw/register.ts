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
 *   - Wraps workbox under the hood — proven cache-first strategy for app
 *     shells with automatic stale-while-revalidate semantics.
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
 * links (`/s/:id`, `/p/:kind/:appId`) took it worst, because they are opened
 * cold from a link on a device whose worker is whatever build it last saw.
 *
 * `vite.config.ts` is now `registerType: 'prompt'`, which emits a worker that
 * installs and WAITS. Nothing is swapped under a live page. The update lands
 * when the user accepts here (post `SKIP_WAITING`, then reload on
 * `controllerchange`) or when every tab has closed.
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
}

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

export function registerServiceWorker(options: RegisterOptions = {}): void {
  const { onUpdateReady = () => {} } = options

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
      watchForUpdate(registration, container, onUpdateReady, () => {
        window.location.reload()
      })
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
