/**
 * observability — browser error reporting for the whole app.
 *
 * Errors are posted to the Worker at `/__errors`, which logs them for Workers
 * Issues (`observability/cloudflare`'s `handleErrorReport`). Same origin, so
 * the CSP's `connect-src 'self'` covers it. Production builds only: the dev
 * server has no Worker to post to. Everything after that gate (the window
 * handlers, the capture verb, chunk recovery) is `createBrowserObservability`
 * in `observability/browser`. Both entries start it: the islands'
 * (`islands.client.ts`) and the Cantina's (`main.tsx`).
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
 * nobody will ever see again. The reference pages opt into cross-document view
 * transitions (`src/styles/global.css`), and the browser rejecting its own
 * promise when it abandons one is the only entry (issues SRD-A, SRD-B, SRD-D),
 * the Cantina's pages included, which a transition reaches from a reference page.
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
 * Catching is exactly what keeps an error from the window's `error` event, so
 * every deliberately-caught error (a render crash an island's boundary caught,
 * a failed Change Log commit) is reportable only through this function.
 */
export const captureException = observability.captureException

/**
 * Reloads once when a chunk is gone from the server: a page open across a
 * deploy, or one served from an older `pages` cache. Installed by each entry
 * before anything lazy loads.
 */
export const installChunkRecovery = observability.installChunkRecovery

/** What React hands an error hook alongside the error. */
type ReactErrorInfo = { componentStack?: string | null }

/**
 * The `createRoot` error hooks, which are what make a render crash get
 * reported at all.
 *
 * The reporter hears uncaught errors through the window's `error` event, and a render
 * error caught by an error boundary never gets there: React catches it, the
 * router renders its error screen, and by default the only trace is a
 * `console.error`. Every route has a boundary (`RouteErrors.tsx`), so that was
 * every render crash in the app — a player saw "Something went wrong" and
 * nothing was recorded anywhere. These hooks are React's own seam for exactly
 * this: `onCaughtError` runs for every error a boundary catches,
 * `onUncaughtError` for one that escapes them all.
 *
 * Both still log, because overriding a hook replaces React's default rather
 * than adding to it — and for `onUncaughtError` the default is `reportError`,
 * which is how the window's `error` event would otherwise have heard of it, so
 * reporting here and not re-raising keeps that to one event.
 */
export const reactRootErrorHandlers = {
  onCaughtError(error: unknown, errorInfo: ReactErrorInfo): void {
    console.error(error)
    captureException(
      error,
      { componentStack: errorInfo.componentStack ?? undefined },
      { tags: { boundary: 'caught' } }
    )
  },
  onUncaughtError(error: unknown, errorInfo: ReactErrorInfo): void {
    console.error(error)
    captureException(
      error,
      { componentStack: errorInfo.componentStack ?? undefined },
      { tags: { boundary: 'uncaught' } }
    )
  },
}
