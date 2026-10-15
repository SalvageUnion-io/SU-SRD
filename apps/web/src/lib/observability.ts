/**
 * observability — browser error reporting for srd.
 *
 * Errors are posted to srd's own Worker at `/__errors`, which logs them for
 * Workers Issues (`observability/cloudflare`'s `handleErrorReport`). Same
 * origin, so the CSP's `connect-src 'self'` covers it. Production builds only:
 * the dev server has no Worker to post to. Everything after that gate (the
 * window handlers, the capture verb, chunk recovery) is
 * `createBrowserObservability` in `observability/browser`, shared with the Cantina.
 *
 * `deploy-cloudflare.yml` sets `VITE_COMMIT_REF` to the deployed SHA, which
 * each report carries as its release.
 */

import {
  ABANDONED_VIEW_TRANSITIONS,
  createBrowserObservability,
  ERROR_REPORT_PATH,
} from 'observability/browser'

/**
 * Browser noise that is not this site's to fix, dropped before it is sent. The
 * bar for adding to this list is deliberately high: a filtered error is one
 * nobody will ever see again. srd opts into cross-document view transitions
 * (`src/styles/global.css`), and the browser rejecting its own promise when it
 * abandons one is the only entry (issues SRD-A, SRD-B, SRD-D).
 */
const observability = createBrowserObservability({ ignoreErrors: ABANDONED_VIEW_TRANSITIONS })

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
