/**
 * The words the router's error screens use (`components/shared/RouteErrors.tsx`),
 * kept apart from the components so they can be tested as plain functions.
 */

import type { BackendKind } from '../stores/entityBackend'
import { BlockedUpgradeError } from './db/index'

/**
 * A blocked IndexedDB upgrade (this site open in another tab on an older
 * build) is a distinct, self-serviceable failure with its own copy. Matched on
 * name too, so a structured clone or a re-wrapped error across the router
 * boundary still hits.
 */
export function isBlockedUpgrade(error: unknown): boolean {
  return (
    error instanceof BlockedUpgradeError ||
    (error as { name?: string } | null)?.name === 'BlockedUpgradeError'
  )
}

/**
 * What an error does to the player's work — which depends on where that work
 * lives, so it is answered per backend rather than with one reassurance.
 *
 * This used to say "Your saved data is stored locally and is not affected" to
 * everybody. Since ADR-034 that is true of nobody in production: a signed-in
 * player's builds live on the server, and an anonymous visitor's live only in
 * this tab, where a reload — the very action the panel offers — loses them.
 */
export function savedWorkCopy(backend: BackendKind | null): string {
  switch (backend) {
    case 'remote':
      return 'Everything saved to your account is stored on the server and is not affected.'
    case 'blocked':
      // `blocked` is also the `connecting` state, before anyone knows whether
      // this visitor is signed in — so it cannot say "your account".
      return 'Anything saved to an account is stored on the server and is not affected.'
    case 'memory':
      return 'Builds that are not saved to an account live only in this tab, and reloading loses them.'
    default:
      return 'Anything already saved is not affected.'
  }
}
