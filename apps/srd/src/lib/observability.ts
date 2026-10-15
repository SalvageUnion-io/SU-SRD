/**
 * observability — browser error reporting for srd.
 *
 * Errors are posted to srd's own Worker at `/__errors`, which logs them for
 * Workers Issues (`observability/cloudflare`'s `handleErrorReport`). Same
 * origin, so the CSP's `connect-src 'self'` covers it. Production builds only:
 * the dev server has no Worker to post to. Everything after that gate (the
 * window handlers, the capture verb, chunk recovery) is
 * `createBrowserObservability` in `observability/browser`, shared with ITUN.
 *
 * `deploy-cloudflare.yml` sets `VITE_COMMIT_REF` to the deployed SHA, which
 * each report carries as its release.
 */

import { createBrowserObservability, ERROR_REPORT_PATH } from 'observability/browser'

/**
 * Browser noise that is not this site's to fix, dropped before it is sent.
 *
 * The bar for adding to this list is deliberately high: a filtered error is one
 * nobody will ever see again, so anything here has to be something we could not
 * act on even if we wanted to. Each entry names the mechanism, not just the
 * string.
 *
 * All three entries below are the same mechanism wearing three different
 * messages. srd opts into *cross-document* view transitions declaratively, with
 * `@view-transition { navigation: auto }` in `src/styles/global.css`. The
 * promises that transition exposes belong to the **user agent** — there is no JS
 * handle of ours to `.catch()` — so when the browser abandons a transition it
 * rejects one of them and the `unhandledrejection` handler hears it. In every
 * case the navigation itself completes normally, which is why the reporter is
 * the only place these can be dropped.
 *
 * - **`Transition was skipped`** — a second navigation supersedes an in-flight
 *   transition (a fast click, or a click during page load). Chrome's wording
 *   (issue SRD-A).
 * - **`Skipping view transition`** — the same abandonment, worded
 *   `Skipping view transition because skipTransition() was called.`, which is
 *   what WebKit and the iOS in-app browsers emit. The `skipTransition()` call
 *   is the browser's own, not ours: nothing in this app has a
 *   `ViewTransition` handle to call it on (issue SRD-B, and by event count the
 *   loudest of the three).
 * - **`Transition was aborted because of invalid state`** — the document was
 *   made ineligible mid-transition, typically by being backgrounded or hidden.
 *   Reported as an `InvalidStateError` rather than an `AbortError`, so the
 *   error *type* is no help in grouping these; the message is (issue SRD-D).
 *
 * Matched as substrings of `${name}: ${message}`, so each entry covers the
 * DOMException name prefix the events actually carry.
 */
const IGNORED_ERRORS = [
  'Transition was skipped',
  'Skipping view transition',
  'Transition was aborted because of invalid state',
]

const observability = createBrowserObservability({ ignoreErrors: IGNORED_ERRORS })

/** Starts reporting in a production build. Idempotent; call it once on every page load. Returns a teardown (tests). */
export function initBrowserObservability(): () => void {
  if (!import.meta.env.PROD) return () => undefined
  return observability.init({
    endpoint: ERROR_REPORT_PATH,
    release: import.meta.env.VITE_COMMIT_REF,
  })
}

/**
 * Reports a caught exception; a no-op before `initBrowserObservability`.
 *
 * Catching is exactly what keeps an error from the window's `error` event, so a
 * render crash inside an island that a boundary caught is reportable only
 * through this function.
 */
export const captureException = observability.captureException

/**
 * Reloads once when an island's chunk is gone from the server: a page open
 * across a deploy, or one served from an older `pages` cache. Installed from
 * `islands.client.ts` before any island is scheduled.
 */
export const installChunkRecovery = observability.installChunkRecovery
