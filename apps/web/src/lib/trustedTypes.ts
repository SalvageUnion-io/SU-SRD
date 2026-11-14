/**
 * trustedTypes — the site's Trusted Types default policy.
 *
 * `public/_headers` asks for `require-trusted-types-for 'script'` (report-only
 * for now). Under it, `navigator.serviceWorker.register('/sw.js')` is a sink
 * fed a plain string, and it was the only one the reports named: our own
 * `registerSiteWorker` and workbox-window's `Workbox.register` in the app both
 * make that call, and workbox-window offers no way to hand it a
 * `TrustedScriptURL`. A `default` policy is the browser's hook for exactly
 * that: every string reaching a script-URL sink passes through it.
 *
 * It lets one URL through: the site worker (`SITE_WORKER.url`) on this page's
 * own origin. Any other script URL is refused (`null`), so it still raises the
 * violation the reporter sends to `/__errors`, and enforcement would block it.
 * It defines no `createHTML` or `createScript`, so those sinks keep reporting
 * as before.
 *
 * Installed first thing by both entries, before either registers the worker:
 * `runtime/islands.client.ts` and `main.tsx`. A page has one default policy,
 * so a second install is a no-op.
 */

import { SITE_WORKER } from '../pwa'

/** The slice of the Trusted Types API this module uses; absent where unsupported. */
type TrustedTypesFactory = {
  defaultPolicy: unknown
  createPolicy: (
    name: 'default',
    rules: { createScriptURL: (input: string) => string | null }
  ) => unknown
}

/** The site worker's URL when `input` names it on `origin`, else `null`. */
export function allowScriptUrl(input: string, origin: string): string | null {
  let url: URL
  try {
    url = new URL(input, origin)
  } catch {
    return null
  }
  if (url.origin !== origin || url.pathname !== SITE_WORKER.url || url.search || url.hash) {
    return null
  }
  return input
}

/** The page `installTrustedTypesPolicy` installs into; tests pass a stand-in. */
type PolicyHost = { trustedTypes?: TrustedTypesFactory; location: Pick<Location, 'origin'> }

export function installTrustedTypesPolicy(
  host: PolicyHost = window as unknown as PolicyHost
): void {
  const factory = host.trustedTypes
  if (!factory || factory.defaultPolicy) return
  const { origin } = host.location
  factory.createPolicy('default', {
    createScriptURL: (input) => allowScriptUrl(input, origin),
  })
}
