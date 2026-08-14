/**
 * _observability — optional Sentry error tracking for the snapshot Netlify
 * Functions.
 *
 * The wiring lives in `observability/node`; this file is the ITUN site's
 * configuration of it. It used to be a byte-identical copy of
 * `apps/su-assets/netlify/functions/_observability.ts`, whose own comment said
 * "there is no reason for the two to drift" — and they had, this one carrying a
 * COMMIT_REF caveat the other lacked.
 *
 * Env-gated: with `SENTRY_DSN` unset, every export is a no-op and no Sentry
 * network call is made. No DSN is committed — it comes from the Netlify site
 * environment. The leading underscore keeps this out of the deployed function
 * routes (Netlify ignores `_`-prefixed files as endpoints).
 */

import { createObservability } from 'observability/node'

const observability = createObservability(() => ({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'production',
  // Tags events with the deployed commit so an error maps back to a specific
  // deploy. COMMIT_REF is a Netlify-provided deploy-metadata var — confirmed
  // present in the *build* shell (netlify.toml's ignore scripts read it
  // directly); whether it also reaches the Function's *runtime* environment is
  // unconfirmed. If release tags don't show up on function errors in Sentry,
  // that's the reason — the fallback is to bake the commit SHA into the bundle
  // at build time (e.g. via an esbuild define) rather than reading it from
  // process.env at runtime.
  release: process.env.COMMIT_REF,
}))

/** Initializes Sentry once per cold start, if SENTRY_DSN is configured. */
export function initObservability(): void {
  observability.init()
}

/** Reports an error to Sentry when enabled; otherwise a no-op. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  observability.captureException(error, context)
}
