/**
 * /s/$id — a retired snapshot link, resolved (ADR-036).
 *
 * Snapshots no longer render. The loader asks the Worker which entity the
 * snapshot was taken of (`GET /api/snapshots/:id` → `{ kind, appId }`); the
 * page then redirects to that entity's live public sheet if its owner has made
 * one, and otherwise says the link has been retired. See `SnapshotLinkView`.
 *
 * The page body is `SnapshotLinkView` in `components/sheet/SnapshotLinkView.tsx`,
 * which tests render directly. This file exports only `Route`, on purpose:
 * any other export stops `autoCodeSplitting` from moving the component out
 * of the entry chunk (see `routes/__tests__/routeExports.test.ts`).
 */

import { createFileRoute } from '@tanstack/react-router'
import { SheetSkeleton } from '../../components/sheet/SheetSkeleton'
import { SnapshotLinkView } from '../../components/sheet/SnapshotLinkView'
import { captureException } from '../../lib/observability'
import { retrieveSnapshotIdentity } from '../../lib/snapshot/client'

export const Route = createFileRoute('/s/$id')({
  loader: async ({ params }) => {
    try {
      return { identity: await retrieveSnapshotIdentity(params.id) }
    } catch (err) {
      // Reported, then shown as retired. Catching is what keeps this from
      // Sentry's global handler, and the only answer worth giving the visitor
      // either way is the retired page — a snapshot link no longer opens a
      // sheet of its own. A 404 never gets here: an unknown snapshot is a
      // designed outcome (`retrieveSnapshotIdentity` returns null), not a fault.
      //
      // Fingerprinted on the route rather than the message, because the
      // messages embed a timeout figure and HTTP status and would otherwise
      // shard one condition across many issues.
      captureException(
        err,
        { snapshotId: params.id },
        {
          fingerprint: ['snapshot-identity-failed'],
          tags: { route: '/s/$id' },
        }
      )
      return { identity: null }
    }
  },
  component: SnapshotLinkRoute,
  // A link that resolves lands on a sheet, so the sheet-shaped skeleton is the
  // honest placeholder while the loader's fetch is in flight.
  pendingComponent: SheetSkeleton,
})

function SnapshotLinkRoute() {
  const { identity } = Route.useLoaderData()
  return <SnapshotLinkView identity={identity} />
}
