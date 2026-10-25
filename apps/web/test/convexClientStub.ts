/**
 * The Convex client every app unit test gets in place of a real one.
 *
 * `src/lib/connection/convexClient.ts` constructs a `ConvexReactClient` at
 * import, and a unit test has no deployment to reach: a real client would
 * queue every mutation behind a connection that never opens, so a signed-in
 * store write (`withSignedInBackend()`) would never settle. Here every server
 * commit lands, at version 1 — the stores run for real.
 *
 * A file that needs to see or refuse the writes replaces this with its own
 * through `installConvexMocks({ convexClient })`
 * (`src/components/__tests__/convexMock.ts`), which restores this one after.
 */

import { mock } from 'bun:test'

mock.module('../src/lib/connection/convexClient', () => ({
  convexClient: {
    // `upsertByAppId` and `ops.apply` answer with the row's version (and
    // seq), `ops.transfer` with each unit's; nothing else reads its answer.
    mutation: async () => ({ updatedAt: 1, headSeq: 1, applied: [] }),
  },
}))
