/**
 * /s/$id — Read-only snapshot route.
 *
 * Fetches a snapshot by ID via the snapshot backend and renders it using
 * SnapshotSheet (a frozen, read-only rendering that does not depend on
 * entityStore or SoftLinks).
 *
 * 404: renders a not-found state with a link back to the dashboard.
 * Other errors: renders a generic error state.
 *
 * The page body is `SnapshotPageInner` in `components/sheet/SnapshotPage.tsx`,
 * which tests render directly. This file exports only `Route`, on purpose:
 * any other export stops `autoCodeSplitting` from moving the component out
 * of the entry chunk (see `routes/__tests__/routeExports.test.ts`).
 */

import { createFileRoute } from '@tanstack/react-router'
import { SheetSkeleton } from 'component-lib'
import { SnapshotPageInner } from '../../components/sheet/SnapshotPage'
import { captureException } from '../../lib/observability'
import { retrieveSnapshot, SnapshotNotFoundError } from '../../lib/snapshot/client'

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/s/$id')({
  loader: async ({ params }) => {
    try {
      const snapshot = await retrieveSnapshot(params.id)
      return { snapshot, notFound: false as const, error: null }
    } catch (err) {
      if (err instanceof SnapshotNotFoundError) {
        return { snapshot: null, notFound: true as const, error: null }
      }

      // Report before rendering the error state. Catching is exactly what stops
      // an error reaching Sentry's global handler, so until now every failure on
      // this route — timeouts, 503s from a Blobs outage, the MIME-type rejection
      // from a rotated-away chunk — was converted into calm on-screen prose and
      // nothing else. The route looked healthy from the outside while being the
      // single most-reported broken surface in the app.
      //
      // A 404 above is deliberately NOT reported: a revoked or expired snapshot
      // is a designed outcome, not a fault, and reporting it would bury the real
      // failures in noise.
      //
      // Fingerprinted on the route rather than the message, because the messages
      // embed a timeout figure and HTTP status and would otherwise shard one
      // condition across many issues.
      captureException(
        err,
        { snapshotId: params.id },
        {
          fingerprint: ['snapshot-retrieve-failed'],
          tags: { route: '/s/$id' },
        }
      )

      const message = err instanceof Error ? err.message : 'Unknown error'
      return { snapshot: null, notFound: false as const, error: message }
    }
  },
  component: SnapshotPage,
  // The loader does a real network fetch with a 10s timeout — show the
  // sheet-shaped skeleton instead of a blank page while it resolves.
  pendingComponent: SheetSkeleton,
})

function SnapshotPage() {
  const { snapshot, notFound, error } = Route.useLoaderData()
  return <SnapshotPageInner snapshot={snapshot} notFound={notFound} error={error} />
}
