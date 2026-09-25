/**
 * SnapshotPageInner — the /s/$id page body, minus the router.
 *
 * Lives here rather than in `routes/s/$id.tsx` so the route file exports
 * nothing but `Route`. TanStack Router's `autoCodeSplitting` can only move a
 * route's component into its own chunk when nothing else in the file is
 * exported; an extra export pinned this component — and through
 * `SnapshotSheet`, the entire live-sheet tree — into the entry chunk that
 * every route downloads (audit AP-11). Tests render it directly.
 */

import { buttonVariants, cn } from 'component-lib'
import type { SnapshotPayload } from '../../lib/snapshot/client'
import { AppLink } from '../shared/AppLink'
import { SnapshotSheet } from './SnapshotSheet'

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
