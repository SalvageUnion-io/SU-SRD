/**
 * Empty the replica, as a fresh page load has it: no rows, nothing arrived,
 * and no feed mounted, so `hydrate()` resolves at once. A test seeds through
 * `adopt` (a row the server sent), `setState`, or a signed-in `create`
 * (`withSignedInBackend()`).
 */

import { resetReplica } from '../replica'

export function resetStores(): void {
  resetReplica()
}
