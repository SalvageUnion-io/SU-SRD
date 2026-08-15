/**
 * observability — optional Sentry error tracking for the snapshot Netlify
 * Functions.
 *
 * The wiring lives in `observability/node`; this file is the ITUN site's
 * configuration of it. It used to be a byte-identical copy of su-assets',
 * whose own comment said "there is no reason for the two to drift" — and they
 * had, this one carrying a COMMIT_REF caveat the other lacked.
 *
 * Env-gated: with `SENTRY_DSN` unset, every export is a no-op and no Sentry
 * network call is made. No DSN is committed — it comes from the Netlify site
 * environment.
 *
 * ## It lives in `lib/`, not `functions/`, and that is not tidying
 *
 * It sat beside the handlers as `functions/_observability.ts` on the belief —
 * written into this header — that "the leading underscore keeps this out of the
 * deployed function routes (Netlify ignores `_`-prefixed files as endpoints)".
 *
 * Netlify does not ignore them. The deploy manifest listed `_observability`
 * among the site's deployed functions, and hitting it confirmed what that meant:
 *
 *     $ curl https://intheunionnow.com/.netlify/functions/_observability
 *     {"errorType":"Runtime.HandlerNotFound",
 *      "errorMessage":"_observability.handler is undefined or not exported"}
 *
 * A public endpoint that 502s and prints an internal path, for a file that is
 * not a handler and never claimed to be. `functions = "apps/itun/netlify/
 * functions"` in netlify.toml is what makes a file a function — a naming
 * convention is not, and cannot be.
 *
 * So the rule is positional: only handlers go in `functions/`. What they import
 * lives here, where esbuild still inlines it into each bundle and the platform
 * never sees it as an endpoint. `tools/check-observability.ts` asserts the
 * location.
 */

import * as Sentry from '@sentry/node'
/*
 * The import below is a RELATIVE path into `packages/observability`, not the
 * `observability` package name, and that is load-bearing rather than stylistic.
 *
 * Resolved through node_modules (i.e. by package name), the shared module
 * becomes a chunk that esbuild emits once per entry point that uses it — and
 * with three snapshot Functions sharing it, zip-it-and-ship-it wrote that chunk
 * into each zip under the FUNCTION'S OWN filename. The zips shipped two files
 * at one path:
 *
 *   apps/itun/netlify/functions/snapshot-retrieve.mjs   3662 bytes  (the function)
 *   apps/itun/netlify/functions/snapshot-retrieve.mjs   1369 bytes  (observability)
 *
 * Last entry wins on extraction, so the Lambda loaded the observability module
 * — which exports `initObservability` and `captureException`, and no handler:
 *
 *   TypeError: D.handler is not a function
 *       at file:///var/task/___netlify-bootstrap.mjs
 *
 * Every snapshot endpoint 502'd. It is invisible in every local signal —
 * typecheck, tests, lint, knip and `bun --filter itun build` all pass, because
 * none of them run the Functions bundler.
 *
 * Importing the source directly makes esbuild inline it into each entry, so
 * there is no shared chunk and no collision. `packages/observability` stays the
 * one implementation (#781's point); only the resolution path changes. The
 * Discord bot still imports it by package name — it bundles with `bun build`,
 * which is not affected.
 *
 * `tools/check-observability.ts` asserts this shape.
 */
import { createObservability } from '../../../../packages/observability/src/node'

// The SDK is imported HERE, not in `observability/node`, so Netlify's bundler
// resolves it from this app and copies it beside the emitted function. See the
// header of packages/observability/src/node.ts — with the import in the shared
// package instead, all three snapshot Functions 502'd at module load.
const observability = createObservability(
  () => ({
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
