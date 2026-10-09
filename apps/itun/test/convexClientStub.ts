/**
 * The Convex client every ITUN unit test gets in place of a real one.
 *
 * `src/lib/connection/convexClient.ts` constructs a `ConvexReactClient` at
 * import, and a unit test has no deployment to reach: a real client would
 * queue every mutation behind a connection that never opens, so a signed-in
 * store write (`withSignedInBackend()`) would never settle. Here every server
 * commit lands, at version 1 — the store, the IndexedDB cache and hydration
 * all run for real.
 *
 * A file that needs to see or refuse the writes replaces this with its own
 * through `installConvexMocks({ convexClient })`
 * (`src/components/__tests__/convexMock.ts`), which restores this one after.
 */

import { mock } from 'bun:test'

mock.module('../src/lib/connection/convexClient', () => ({
  convexClient: {
    // `upsertByAppId` answers with the row's version, `transfer` with each
    // record's; nothing else reads its answer.
    mutation: async () => ({ updatedAt: 1, versions: [] }),
  },
}))
