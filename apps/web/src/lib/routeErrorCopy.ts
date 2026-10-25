/**
 * The words the router's error screens use (`components/shared/RouteErrors.tsx`),
 * kept apart from the components so they can be tested as plain functions.
 */

import type { SyncStatus } from '../replica/sync'

/**
 * What an error does to the player's work — which depends on where that work
 * lives, so it is answered per sync status rather than with one reassurance: a
 * signed-in player's builds live on the server, and a signed-out visitor has
 * none (ADR-034).
 */
export function savedWorkCopy(status: SyncStatus | null): string {
  switch (status) {
    case 'live':
    case 'offline':
      return 'Everything saved to your account is stored on the server and is not affected.'
    case 'syncing':
      // Before anyone knows whether this visitor is signed in — so it cannot say "your account".
      return 'Anything saved to an account is stored on the server and is not affected.'
    case 'signedOut':
      // Signed out: nothing can be built without an account, so there is no
      // unsaved work for a reload to lose.
      return 'Nothing is built without an account, so reloading loses nothing.'
    default:
      return 'Anything already saved is not affected.'
  }
}
