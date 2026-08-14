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
 * The `retrieveFn` prop is not supported on TanStack Router file routes
 * directly, so we expose the retrieve function as a module-level export
 * for testability. Tests render SnapshotPage directly and stub
 * retrieveSnapshot at the import boundary via test utilities.
 */

import { createFileRoute } from '@tanstack/react-router'
import { buttonVariants, SheetSkeleton } from 'component-lib'
import { AppLink } from '../../components/shared/AppLink'
import { SnapshotSheet } from '../../components/sheet/SnapshotSheet'
import { captureException } from '../../lib/observability'
import type { SnapshotPayload } from '../../lib/snapshot/client'
import { retrieveSnapshot, SnapshotNotFoundError } from '../../lib/snapshot/client'
import { cn } from '../../lib/utils'

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

// ---------------------------------------------------------------------------
// Page component — exported for direct testing
// ---------------------------------------------------------------------------

type SnapshotPageInnerProps = {
  snapshot: SnapshotPayload | null
  notFound: boolean
  error: string | null
}

export function SnapshotPageInner({ snapshot, notFound, error }: SnapshotPageInnerProps) {
  if (notFound) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-xl font-bold">Snapshot not found</h1>
        <p className="mb-4 text-sm text-wk-muted">
          This snapshot link was removed by its owner, or never existed.
        </p>
        <AppLink
          href="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'no-underline')}
        >
          &larr; Back to Roster
        </AppLink>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-xl font-bold">Failed to load snapshot</h1>
        <p className="mb-4 text-sm text-wk-muted">{error}</p>
        <AppLink
          href="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'no-underline')}
        >
          &larr; Back to Roster
        </AppLink>
      </main>
    )
  }

  if (!snapshot) {
    return null
  }

  return <SnapshotSheet snapshot={snapshot} />
}

function SnapshotPage() {
  const { snapshot, notFound, error } = Route.useLoaderData()
  return <SnapshotPageInner snapshot={snapshot} notFound={notFound} error={error} />
}
