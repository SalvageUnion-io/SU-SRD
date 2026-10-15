/**
 * observability — browser error reporting for the Cantina.
 *
 * Errors are posted to the Cantina's own Worker at `/build/__errors`, which logs them
 * for Workers Issues (`observability/cloudflare`'s `handleErrorReport`). Same
 * origin, so the CSP's `connect-src 'self'` covers it. Production builds only:
 * the dev server has no Worker to post to. Everything after that gate (the
 * window handlers, the capture verb, chunk recovery) is
 * `createBrowserObservability` in `observability/browser`, shared with srd.
 *
 * `deploy-cloudflare.yml` sets `VITE_COMMIT_REF` to the deployed SHA, which
 * each report carries as its release.
 */

import { createBrowserObservability, ERROR_REPORT_PATH } from 'observability/browser'
import { basePathOf, SITE } from './site'

const observability = createBrowserObservability()

/** Starts reporting in a production build. Idempotent; call it once on load. Returns a teardown (tests). */
export function initBrowserObservability(): () => void {
  if (!import.meta.env.PROD) return () => undefined
  return observability.init({
    endpoint: `${basePathOf(SITE.base)}${ERROR_REPORT_PATH}`,
    release: import.meta.env.VITE_COMMIT_REF,
  })
}

/**
 * Reports a caught exception; a no-op before `initBrowserObservability`.
 *
 * Catching is exactly what keeps an error from the window's `error` event, so
 * every deliberately-caught error in the app — including a failed Change Log
 * commit — is reportable only through this function.
 */
export const captureException = observability.captureException

/**
 * Reloads once when a lazy chunk's build is gone from the server. Installed
 * from `main.tsx` before render: the very first route can throw it.
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
