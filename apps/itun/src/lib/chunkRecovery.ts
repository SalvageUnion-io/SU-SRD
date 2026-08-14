/**
 * chunkRecovery — survive a deploy that lands while the page is open.
 *
 * ITUN is code-split (`autoCodeSplitting` in vite.config.ts) and preloads the
 * whole reference dataset as ~30 dynamic imports (`GameDataReady`), so a single
 * route render can pull a dozen hashed chunks *after* first paint. Every one of
 * those URLs is only valid for the build that emitted it.
 *
 * That window is not rare here. The PWA serves navigations cache-first from a
 * precached `index.html`, then — on `skipWaiting` + `clientsClaim` +
 * `cleanupOutdatedCaches` — installs the new build and deletes the old precache
 * *underneath the live page*. The page carries on asking for chunk names that
 * no longer exist anywhere, and at ~3 deploys a day the odds of a share link
 * being opened inside that window are not small. Symptom: a snapshot or public
 * sheet that renders only after four or five refreshes.
 *
 * The fix is to notice and reload once, because a reload fetches a current
 * `index.html` naming current hashes. It pairs with the `/assets/*` → 404 rule
 * in `netlify.toml`: without that rule a missing chunk came back as `200
 * text/html` from the SPA fallback, which fails the import on MIME type but is
 * also, thanks to the `/assets/*` header block, cached `immutable` for a year.
 *
 * Deliberately narrow: this listens for Vite's own `vite:preloadError`, which
 * is emitted by the `__vitePreload` helper that wraps every dynamic import in
 * the build. A chunk that fails some other way (a `<script>` tag, a non-Vite
 * fetch) is not covered and should not be bolted on here without evidence it
 * happens.
 */

import { captureException } from './observability'

/**
 * sessionStorage key holding the epoch-ms of the last recovery reload.
 *
 * Session-scoped on purpose: the condition is "this tab is running a build the
 * server no longer has", which a new tab does not inherit.
 */
const LAST_RELOAD_KEY = 'itun:chunk-reload-at'

/**
 * How long a recovery reload suppresses the next one.
 *
 * This is the loop guard, and it is a cooldown rather than a one-shot flag for
 * a reason. A one-shot flag never rearms, so a second deploy later in the same
 * long-lived tab — the exact thing this recovers from — would go unhandled. A
 * cooldown rearms on its own while still making an infinite reload loop
 * impossible: if the very next load fails the same way, we let the error
 * surface to the root error boundary instead of reloading again.
 */
const RELOAD_COOLDOWN_MS = 20_000

/** Vite dispatches this on `window` with the failed import's error as `payload`. */
type PreloadErrorEvent = Event & { payload?: unknown }

/**
 * sessionStorage throws rather than degrading in some privacy modes (Safari
 * private windows, cookies-blocked iframes). Recovery must not depend on
 * storage being writable, so both accessors fail soft — a read failure means
 * "no cooldown recorded", which errs toward reloading, and the reload itself is
 * still bounded because a repeat failure lands on a page that cannot record one
 * either and therefore reloads at most as fast as the network serves it.
 */
function readLastReloadAt(storage: Storage | undefined): number {
  if (!storage) return 0
  try {
    return Number(storage.getItem(LAST_RELOAD_KEY)) || 0
  } catch {
    return 0
  }
}

function writeLastReloadAt(storage: Storage | undefined, at: number): void {
  if (!storage) return
  try {
    storage.setItem(LAST_RELOAD_KEY, String(at))
  } catch {
    // Non-fatal: we lose the loop guard, not the recovery.
  }
}

export type ChunkRecoveryDeps = {
  /** Defaults to `window.sessionStorage`; pass a stub in tests. */
  storage?: Storage
  /** Defaults to a hard reload. */
  reload?: () => void
  /** Defaults to `Date.now`. */
  now?: () => number
}

/**
 * Installs the `vite:preloadError` listener. Idempotent per call site — call it
 * once, from the entry module.
 *
 * @returns a teardown function that removes the listener (used by tests).
 */
export function installChunkRecovery(deps: ChunkRecoveryDeps = {}): () => void {
  const {
    storage = typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
    reload = () => {
      window.location.reload()
    },
    now = Date.now,
  } = deps

  const onPreloadError = (event: Event) => {
    const error = (event as PreloadErrorEvent).payload ?? event

    const at = now()
    const since = at - readLastReloadAt(storage)
    const willReload = since >= RELOAD_COOLDOWN_MS

    // Report either way. A chunk failure that reloads is invisible to the user
    // and would otherwise be invisible to us too — which is how this shipped
    // undiagnosed in the first place. The fingerprint is fixed so every one of
    // these lands in a single issue: the message carries a bundle hash, so
    // Sentry's default grouping would mint a fresh issue per deploy.
    captureException(
      error,
      { recovered: willReload, msSinceLastReload: since },
      {
        fingerprint: ['chunk-preload-error'],
        tags: { recovered: String(willReload) },
      }
    )

    if (!willReload) {
      // Second failure inside the cooldown: stop. Let Vite rethrow so the root
      // error boundary shows its recovery panel rather than looping.
      return
    }

    writeLastReloadAt(storage, at)
    // Suppress Vite's default rethrow — we are handling this by reloading, and
    // an uncaught error here would also trip the root error boundary mid-reload.
    event.preventDefault()
    reload()
  }

  window.addEventListener('vite:preloadError', onPreloadError)
  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError)
  }
}
