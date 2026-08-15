/**
 * _observability — optional Sentry error tracking for the artwork function.
 *
 * The wiring lives in `observability/node`; this file is the su-assets site's
 * configuration of it. It used to be a byte-identical copy of ITUN's, kept in
 * step by a comment rather than by code — which is precisely how the two came
 * to differ.
 *
 * Entirely env-gated: with `SENTRY_DSN` unset (local dev, tests, forks) every
 * export is a no-op and no Sentry network call is made. No DSN is ever
 * committed — it comes from the `su-assets` Netlify site environment.
 *
 * The leading underscore keeps this out of the deployed function routes
 * (Netlify ignores `_`-prefixed files as endpoints), which matters more here
 * than on itun: `asset.ts` claims `path: '/*'`, so a second routable function
 * in this directory would be an unclaimed endpoint on the artwork host.
 */

import * as Sentry from '@sentry/node'
import { createObservability } from 'observability/node'

// Imported HERE rather than in the shared package so Netlify's bundler resolves
// it from this app — see packages/observability/src/node.ts. itun is where that
// broke in production; this site had the identical wiring and had simply not
// redeployed yet.
const observability = createObservability(
  () => ({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    // See the itun module for the COMMIT_REF-at-runtime caveat and its fallback.
    release: process.env.COMMIT_REF,
  }),
  Sentry
)

/** Initializes Sentry once per cold start, if SENTRY_DSN is configured. */
export function initObservability(): void {
  observability.init()
}

/** Reports an error to Sentry when enabled; otherwise a no-op. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  observability.captureException(error, context)
}
