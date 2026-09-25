/**
 * observability — optional browser Sentry error tracking for srd.
 *
 * Entirely env-gated: when `VITE_SENTRY_DSN` is unset (local dev, tests, and
 * any build without the var provisioned) this is a no-op and no Sentry code
 * runs or ships. Because the DSN is read from `import.meta.env` — which Vite
 * statically inlines at build — an unset DSN makes the `@sentry/browser`
 * dynamic import unreachable, so it is tree-shaken out of the client bundle
 * entirely. That guard is the one part that must live here; the rest (init
 * options, idempotency, the capture verbs) is `createBrowserObservability` in
 * `observability/browser`, shared with ITUN (audit AP-12).
 *
 * No DSN is ever committed. `deploy-cloudflare.yml` supplies it as
 * `VITE_SENTRY_DSN` from the `SRD_SENTRY_DSN` repository variable, with
 * `VITE_COMMIT_REF` set to the deployed SHA.
 *
 * CSP note: the browser SDK POSTs events to the ingest host encoded in the
 * DSN, so that origin must be in `connect-src` in `public/_headers` —
 * `tools/check-observability.ts` asserts it.
 */

import { createBrowserObservability } from 'observability/browser'

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
 * rejects one of them and Sentry's `onunhandledrejection` handler reports it. In
 * every case the navigation itself completes normally, which is why the SDK is
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
 * Matched as substrings of Sentry's `${type}: ${value}`, so each entry covers
 * the DOMException name prefix the events actually carry.
 */
const IGNORED_ERRORS = [
  'Transition was skipped',
  'Skipping view transition',
  'Transition was aborted because of invalid state',
]

const observability = createBrowserObservability({ ignoreErrors: IGNORED_ERRORS })

/**
 * Initializes browser Sentry when `VITE_SENTRY_DSN` is configured.
 * Idempotent and safe to call once on every page load. Resolves immediately
 * (no-op) when the DSN is absent.
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
 * Reports a caught exception to Sentry when enabled; otherwise a no-op.
 *
 * This exists because catching is exactly what PREVENTS an error reaching
 * Sentry's `globalHandlers` integration, so a render crash inside an island
 * that a boundary caught is reportable only through this function.
 */
export const captureException = observability.captureException
