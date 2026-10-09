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
 *   - Hand-written SW alternative would require: manual glob patterns,
 *     cache versioning, skipWaiting/clientsClaim logic — all solved by
 *     workbox already.
 *
 * ONE registration: the plugin's `virtual:pwa-register`. main.tsx imports it
 * and hands its `registerSW` to `registerServiceWorker` below; the plugin
 * injects no `/registerSW.js` into the built index.html (`injectRegister:
 * false` in vite.config.ts). The virtual module resolves
 * only in Vite's build, so this file takes it as an argument and the tests
 * pass a stand-in. Under `vite dev` the plugin serves a no-op `registerSW`, so
 * HMR runs without a worker.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A PROMPT AND NOT A SILENT AUTO-UPDATE
 *
 * Under `registerType: 'autoUpdate'` the plugin forces `skipWaiting` +
 * `clientsClaim`, so a newly installed worker would claim the page already
 * open and run `cleanupOutdatedCaches()`, deleting the precache entries that
 * page still resolves its code-split chunks against.
 *
 * `vite.config.ts` sets `registerType: 'prompt'`, which emits a worker that
 * installs and WAITS. Nothing is swapped under a live page. The update lands
 * when this page asks for it (`reloadOntoNewBuild`: post `SKIP_WAITING`, then
 * reload on `controllerchange`) or when every tab has closed. In prompt mode
 * `virtual:pwa-register` also reloads a tab that saw the worker waiting once
 * that worker takes control, so every open tab moves onto the new build
 * together.
 *
 * ---------------------------------------------------------------------------
 * WHO ASKS: THE BACKEND'S BUILD FLOOR
 *
 * `workbox.ts` sends every navigation to the network, so a page load already
 * boots the deployed build; the waiting worker only brings the precache up to
 * date. The tab that runs an old build is the one that stays open across a
 * deploy, and an installed PWA that is never closed.
 *
 * Every deploy raises the Convex build floor (`convex/build.ts`); a tab whose
 * bundle is older stops writing at once and, as soon as the Worker serves a
 * different shell (`serverBootsAnotherBuild`), reloads through
 * `reloadOntoNewBuild` — `src/lib/connection/buildFloor.ts` owns that loop.
 * `keepCheckingForUpdates` asks for a new worker on registration, whenever the
 * tab becomes visible and hourly, so the matching precache is usually already
 * installed and waiting when the floor moves.
 */

import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
import { captureException } from '../observability'

export type RegisterOptions = {
  /**
   * The path of the chunk this page booted from — main.tsx passes
   * `new URL(import.meta.url).pathname`. Its content hash names the build, so
   * finding it in the server's current shell means the server still boots this
   * page's build (see `serverBootsAnotherBuild`).
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

/** The entry chunk `registerServiceWorker` was told this page booted from. */
let bootedEntryChunk: string | undefined

/**
 * Guards against a double reload: `controllerchange` can fire more than once
 * (notably if two tabs activate the same worker at nearly the same moment),
 * and a second reload mid-navigation is user-visible jank.
 */
let reloading = false

/**
 * Activates a waiting worker and reloads once it has taken control.
 *
 * Exported for tests — it takes only the slice of the SW API it uses, so a
 * plain object stands in for a real registration.
 *
 * The reload is driven by `controllerchange` rather than fired straight after
 * `postMessage` because `skipWaiting()` is asynchronous: reloading immediately
 * races the activation and can land back on the OLD worker.
 */
export function activateWaitingWorker(
  registration: Pick<ServiceWorkerRegistration, 'waiting'>,
  container: Pick<ServiceWorkerContainer, 'addEventListener'>,
  reload: () => void
): void {
  const waiting = registration.waiting
  if (!waiting) {
    // Nothing waiting (the new worker has not installed yet, or it activated
    // on its own because the last controlled tab closed). Navigations are
    // network-first, so a plain reload still boots the new build.
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
 * Moves this tab onto the build the server now serves: activates the waiting
 * worker if there is one, then reloads. With no service worker at all (dev, an
 * unsupported browser) it is a plain reload.
 */
export async function reloadOntoNewBuild(
  container: ServiceWorkerContainer | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.serviceWorker,
  reload: () => void = () => window.location.reload()
): Promise<void> {
  const registration = await container?.getRegistration().catch(() => undefined)
  if (!container || !registration) {
    reload()
    return
  }
  activateWaitingWorker(registration, container, reload)
}

/**
 * Does the server now boot a different build from the one this page runs?
 *
 * Read off the server's current shell: this page is current while that shell
 * references the same content-hashed entry chunk. Any failure — offline, a
 * non-2xx, a blocked fetch, no recorded entry chunk — answers `false`, because
 * the caller reloads on `true`, and a reload the server cannot answer boots
 * the precached old build straight back into the same state: a loop.
 */
export async function serverBootsAnotherBuild(
  entryChunk: string | undefined = bootedEntryChunk,
  fetchShell: () => Promise<Response> = () => fetch(SHELL_PROBE, { cache: 'no-store' })
): Promise<boolean> {
  if (entryChunk === undefined) return false
  try {
    const response = await fetchShell()
    if (!response.ok) return false
    return !(await response.text()).includes(entryChunk)
  } catch {
    // Unreachable server: which build it serves is unknown, so do not reload.
    // The caller asks again on its next backoff step.
    return false
  }
}

/**
 * Asks the browser to look for a new worker: once now, whenever the document
 * becomes visible, and every `UPDATE_CHECK_INTERVAL_MS` while it is visible.
 *
 * The browser checks by itself on every navigation, which a SPA almost never
 * makes — so without this, a long-lived tab or an installed PWA only ever
 * installed a deploy's worker on its next cold start, and the build floor's
 * reload would find nothing waiting to activate.
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

/** The registration function `virtual:pwa-register` exports. */
export type RegisterSW = (options: RegisterSWOptions) => unknown

/**
 * Registers the service worker through `virtual:pwa-register` and keeps a
 * long-lived tab asking for a new one (`keepCheckingForUpdates`).
 *
 * A failed registration is not fatal — the app runs fine uncached — but it is
 * reported under one fingerprint rather than left as an anonymous rejection.
 */
export function registerServiceWorker(registerSW: RegisterSW, options: RegisterOptions = {}): void {
  bootedEntryChunk = options.entryChunk
  registerSW({
    onRegisteredSW: (_swUrl, registration) => {
      if (registration !== undefined) keepCheckingForUpdates(registration, document)
    },
    onRegisterError: (error: unknown) => {
      captureException(
        error,
        { stage: 'serviceWorker.register' },
        { fingerprint: ['sw-register-failed'] }
      )
    },
  })
}
