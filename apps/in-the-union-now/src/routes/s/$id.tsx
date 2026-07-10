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

import { retrieveSnapshot, SnapshotNotFoundError } from '../../lib/snapshot/client'
import type { SnapshotPayload } from '../../lib/snapshot/client'
import { AppLink } from '../../components/shared/AppLink'
import { SheetSkeleton } from '../../components/sheet/SheetSkeleton'
import { SnapshotSheet } from '../../components/sheet/SnapshotSheet'
import { btnVariants } from 'suref-react'
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
          className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
        >
          &larr; Back to dashboard
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
          className={cn(btnVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
        >
          &larr; Back to dashboard
        </AppLink>
      </main>
    )
  }

  if (!snapshot) {
    return null
  }

  return <SnapshotSheet snapshot={snapshot as Record<string, unknown>} />
}

function SnapshotPage() {
  const { snapshot, notFound, error } = Route.useLoaderData()
  return <SnapshotPageInner snapshot={snapshot} notFound={notFound} error={error} />
}
