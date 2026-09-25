/**
 * observability — optional browser Sentry error tracking for ITUN.
 *
 * Entirely env-gated: when `VITE_SENTRY_DSN` is unset (local dev, tests, and
 * any build without the var provisioned) this is a no-op and no Sentry code
 * runs or ships. Because the DSN is read from `import.meta.env` — which Vite
 * statically inlines at build — an unset DSN makes the `@sentry/browser`
 * dynamic import unreachable, so it is tree-shaken out of the client bundle
 * entirely. That guard is the one part that must live here; the rest (init
 * options, idempotency, the capture verbs, de-duplication) is
 * `createBrowserObservability` in `observability/browser`, shared with srd
 * (audit AP-12).
 *
 * No DSN is ever committed. `deploy-cloudflare.yml` supplies it from the
 * `VITE_SENTRY_DSN` repository variable, with `VITE_COMMIT_REF` set to the
 * deployed SHA — the same value `vite.config.ts` names the sourcemap release
 * with, so the two must stay in step.
 */

import { createBrowserObservability } from 'observability/browser'

/**
 * `dedupe`: error objects already sent are not sent again, so one failure seen
 * from two places is one event. It happens for real: a chunk that fails to
 * load is reported by `chunkRecovery` with its own fingerprint, and — when the
 * reload cooldown holds it back — the same error then surfaces in the error
 * boundary that `reactRootErrorHandlers` reports from. The set is global, so
 * code that reports the *same* error object twice (once per retry, say) sends
 * one event, not two; wrap or re-create the error if each attempt should be
 * its own event.
 */
const observability = createBrowserObservability({ dedupe: true })

/**
 * Initializes browser Sentry when `VITE_SENTRY_DSN` is configured. Idempotent
 * and safe to call once on load. Resolves immediately (no-op) when the DSN is
 * absent.
 */
export async function initBrowserObservability(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  // Keep this guard HERE, ahead of the import below: it is what Vite folds to
  // make `@sentry/browser` unreachable in a DSN-less build.
  if (!dsn) return

  await observability.init(() => import('@sentry/browser'), {
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_COMMIT_REF,
  })
}

/**
 * Reports an informational message to Sentry when enabled; otherwise a no-op.
 * Used to surface snapshot-backend outages that `probeSnapshotService`
 * already feature-detects — this does not add a new probe, it just makes an
 * existing silent feature-detect alert-worthy.
 */
export const captureMessage = observability.captureMessage

/**
 * Reports a caught exception to Sentry when enabled; otherwise a no-op.
 *
 * This exists because catching is exactly what PREVENTS an error reaching
 * Sentry's `globalHandlers` integration, so every deliberately-caught error in
 * the app — including a failed mirror to the server of record — is reportable
 * only through this function.
 */
export const captureException = observability.captureException

/** What React hands an error hook alongside the error. */
type ReactErrorInfo = { componentStack?: string | null }

/**
 * The `createRoot` error hooks, which are what make a render crash reach
 * Sentry at all.
 *
 * Sentry's browser SDK hears errors through `window.onerror`, and a render
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
 * which is how Sentry would otherwise have heard of it, so reporting here and
 * not re-raising keeps that to one event.
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
