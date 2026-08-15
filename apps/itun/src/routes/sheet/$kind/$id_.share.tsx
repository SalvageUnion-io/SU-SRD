/**
 * /sheet/$kind/$id/share — retired Share Snapshot screen, now a redirect.
 *
 * Sharing stopped being a place you go (#793): the screen's whole left half
 * previewed the sheet you were one click away from, so it became
 * `ShareStatusDialog` over the live sheet itself. This route is what stops a
 * bookmark or a pasted builder link from dead-ending on the not-found page.
 *
 * It redirects to the sheet rather than opening the dialog. The URL never
 * carried publish state — it was only ever a way to reach the controls — and
 * landing on the sheet puts the reader exactly where the controls now live, one
 * click from Share.
 *
 * `replace: true` keeps the retired URL out of history, so Back goes where the
 * reader came from instead of bouncing off this redirect.
 *
 * ## This is the belt; netlify.toml has the braces
 *
 * A 301 in netlify.toml alone would NOT be enough, and that is worth stating
 * because it looks like it should be. The app is a PWA whose service worker
 * registers a `NavigationRoute` bound to a precached `index.html`
 * (`createHandlerBoundToURL("index.html")` in the deployed sw.js), so for anyone
 * who has the app installed or cached, a navigation is answered from the cache
 * and never reaches Netlify. The edge redirect covers first-time loads, crawlers
 * and non-SW clients; this route covers everyone else. Both are needed.
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/sheet/$kind/$id_/share')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/sheet/$kind/$id',
      params: { kind: params.kind, id: params.id },
      replace: true,
    })
  },
})
