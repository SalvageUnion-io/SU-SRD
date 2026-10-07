/**
 * chunkRecovery — reload once when a page asks for a chunk its build no longer has.
 *
 * Every island is its own hashed chunk (`islandRegistry.ts`), loaded after the
 * page renders — `visible` islands only when scrolled to — and several pull
 * per-schema data chunks after that. Each of those URLs exists only for the
 * build that emitted the page.
 *
 * A page can outlive its build in two ordinary ways:
 *
 * - **It was open when a deploy landed.** The new service worker takes over at
 *   once (`ssg/pwa.ts` explains why srd keeps `skipWaiting` + `clientsClaim`)
 *   and drops the old build's chunks from the precache, and the server stopped
 *   serving them with the deploy.
 * - **It came from the `pages` cache** — offline, or after the network timed
 *   out — and the cached copy is from an older build.
 *
 * Before this, the island's import rejected, `islands.client.ts` logged it, and
 * header search and the mobile nav simply never mounted. A reload fixes it,
 * because navigations are network-first: the reload fetches the current HTML,
 * naming current chunks.
 *
 * This is ITUN's `src/lib/chunkRecovery.ts`, adapted: same event, same
 * cooldown-not-one-shot loop guard, same fail-soft storage.
 *
 * Deliberately narrow: it listens for Vite's own `vite:preloadError`, emitted by
 * the `__vitePreload` helper that wraps every dynamic import in the client
 * bundle — island chunks, the data chunks behind them, and `offlineWarm`. A
 * failure some other way (a `<script>` tag, a plain fetch) is not covered.
 */

import { captureException } from '../lib/observability'

/**
 * sessionStorage key holding the epoch-ms of the last recovery reload.
 *
 * Session-scoped on purpose: the condition is "this tab is showing a page the
 * server no longer has the chunks for", which a new tab does not inherit.
 */
const LAST_RELOAD_KEY = 'srd:chunk-reload-at'

/**
 * How long a recovery reload suppresses the next one.
 *
 * A cooldown rather than a one-shot flag: a one-shot never rearms, so a second
 * deploy later in the same tab would go unhandled. A cooldown rearms on its own
 * and still makes a reload loop impossible — if the very next load fails the
 * same way (an offline page whose cached copy is stale), the error is left to
 * surface instead of reloading again.
 */
const RELOAD_COOLDOWN_MS = 20_000

/** Vite dispatches this on `window` with the failed import's error as `payload`. */
type PreloadErrorEvent = Event & { payload?: unknown }

/**
 * sessionStorage throws rather than degrading in some privacy modes. Recovery
 * must not depend on it, so both accessors fail soft: a failed read means "no
 * cooldown recorded", which errs toward reloading.
 */
function readLastReloadAt(storage: Storage | undefined): number {
  if (!storage) return 0
  try {
    return Number(storage.getItem(LAST_RELOAD_KEY)) || 0
  } catch {
    // Storage denied: no record of a recent reload, so recovery may reload.
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
 * Installs the `vite:preloadError` listener. Call it once, from
 * `islands.client.ts`, before any island is scheduled.
 *
 * @returns a teardown that removes the listener (used by tests).
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

    // Reported either way: a failure that reloads is invisible to the reader
    // and would otherwise be invisible to us too. A fixed fingerprint, because
    // the message carries a bundle hash and would mint a new issue per deploy.
    captureException(
      error,
      { recovered: willReload, msSinceLastReload: since },
      { fingerprint: ['chunk-preload-error'], tags: { recovered: String(willReload) } }
    )

    if (!willReload) {
      // Second failure inside the cooldown: stop, and let Vite rethrow so the
      // island's own catch logs it rather than looping.
      return
    }

    writeLastReloadAt(storage, at)
    // Suppress Vite's rethrow — this is being handled by reloading.
    event.preventDefault()
    reload()
  }

  window.addEventListener('vite:preloadError', onPreloadError)
  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError)
  }
}
