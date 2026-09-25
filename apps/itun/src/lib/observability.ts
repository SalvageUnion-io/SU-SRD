/**
 * observability — optional browser Sentry error tracking for ITUN.
 *
 * Entirely env-gated, mirroring the backend discipline
 * (apps/discord-bot/src/observability.ts and the snapshot function's
 * netlify/functions/_observability.ts): when `VITE_SENTRY_DSN` is unset (local
 * dev, tests, and any deploy without the var provisioned) this is a no-op and
 * no Sentry code runs or ships. Because the DSN is read from `import.meta.env`
 * — which Vite statically inlines at build — an unset DSN makes the
 * `@sentry/browser` dynamic import unreachable, so it is tree-shaken out of the
 * client bundle entirely.
 *
 * No DSN is ever committed; it is supplied via the host's build environment
 * (Netlify) as a `VITE_`-prefixed variable so Vite exposes it to the client.
 * This is the client counterpart to the server-side `SENTRY_DSN` used by the
 * snapshot Netlify function.
 */

import type { CaptureOptions } from 'observability/browser'
import { buildCaptureHint } from 'observability/browser'

export type { CaptureOptions }

let initialized = false
let sentryModule: typeof import('@sentry/browser') | null = null

/**
 * Initializes browser Sentry when `VITE_SENTRY_DSN` is configured. Idempotent
 * and safe to call once on load. Resolves immediately (no-op) when the DSN is
 * absent.
 */
export async function initBrowserObservability(): Promise<void> {
  if (initialized) return

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  initialized = true

  const Sentry = await import('@sentry/browser')
  sentryModule = Sentry
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Tags events with the deployed commit so an error maps back to a
    // specific deploy. VITE_COMMIT_REF is set by netlify.toml's build command
    // (`VITE_COMMIT_REF="$COMMIT_REF" bun ... build`), mirroring Netlify's own
    // COMMIT_REF; unset locally, so dev builds simply omit the tag. Must stay
    // in sync with the release name @sentry/vite-plugin uploads sourcemaps
    // under (see vite.config.ts) — a mismatch means sourcemaps silently don't
    // apply to production errors.
    release: import.meta.env.VITE_COMMIT_REF || undefined,
    // Errors only — no performance tracing or session replay. Keeps network
    // chatter minimal and avoids additional CSP surface.
    tracesSampleRate: 0,
  })
}

/**
 * Reports an informational message to Sentry when enabled; otherwise a no-op.
 * Used to surface snapshot-backend outages that `probeSnapshotService`
 * already feature-detects (see ShareSnapshotScreen) — this does not add a new
 * probe, it just makes an existing silent feature-detect alert-worthy.
 */
export function captureMessage(message: string, context?: Record<string, unknown>): void {
  if (!sentryModule) return
  sentryModule.captureMessage(message, context ? { extra: context } : undefined)
}

/**
 * Reports a caught exception to Sentry when enabled; otherwise a no-op.
 *
 * This exists because catching is exactly what PREVENTS an error reaching
 * Sentry's `globalHandlers` integration. Until now this module exported only
 * `captureMessage`, so every deliberately-caught error in the app — including
 * a failed mirror to the server of record — was structurally unreportable,
 * while the node-side modules (`apps/discord-bot/src/observability.ts`,
 * `apps/itun/netlify/functions/_observability.ts`) had had this verb all along.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
  options?: CaptureOptions
): void {
  if (!sentryModule) return
  if (alreadyReported(error)) return

  sentryModule.captureException(error, buildCaptureHint(context, options))
}

/**
 * Error objects already sent, so one failure seen from two places is one
 * event.
 *
 * It happens for real: a chunk that fails to load is reported by
 * `chunkRecovery` with its own fingerprint, and — when the reload cooldown
 * holds it back — the same error then surfaces in the error boundary that
 * `reactRootErrorHandlers` reports from. A WeakSet, so a reported error is
 * still collectable; primitives cannot be tracked and are always sent.
 *
 * The set is global, so the side effect is deliberate: code that reports the
 * *same* error object twice (once per retry, say) sends one event, not two.
 * Wrap or re-create the error if each attempt should be its own event.
 */
const reported = new WeakSet<object>()

function alreadyReported(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if (reported.has(error)) return true
  reported.add(error)
  return false
}

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
