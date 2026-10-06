/**
 * SnapshotLinkView — the `/s/$id` page body, minus the router (ADR-036).
 *
 * Snapshots are retired, so an old share link no longer opens a frozen copy.
 * It resolves instead:
 *
 *   - the entity the snapshot was taken of is **public** → replace this URL
 *     with its live public sheet, `/p/:kind/:appId` (ADR-032);
 *   - anything else — not public, never reached an account, an unknown or
 *     malformed id, a build with no Convex — → "This share link has been
 *     retired", with a way back.
 *
 * "Is it public" is asked of `publicSheet.get`, the deliberately
 * unauthenticated query the public page itself runs, rather than a new one. A
 * private entity and a nonexistent one are the same `null` there on purpose,
 * and they are the same page here for the same reason: the retired page must
 * not confirm that a link's entity still exists.
 *
 * Lives here rather than in the route file so that file exports nothing but
 * `Route` (see `routes/__tests__/routeExports.test.ts`). Tests render it
 * directly.
 */

import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import type { SnapshotIdentity } from '../../lib/snapshot/identity'
import { NotFoundPanel } from '../shared/RouteFallbacks'
import { SheetSkeleton } from './SheetSkeleton'

/** What an old snapshot link shows when it cannot be resolved to a live sheet. */
function RetiredShareLink() {
  return (
    <NotFoundPanel
      title="This share link has been retired"
      message={
        <>
          Snapshot links no longer show a copy of a sheet. If someone sent you this one, ask them to
          share their live public sheet instead — that link stays up to date as they play.
        </>
      }
    />
  )
}

/**
 * The half that talks to Convex, split out so the hook is never reached in a
 * build that has no client — `useQuery` throws without a provider, `'skip'`
 * included (see `PublicSheetView.tsx`).
 */
function PublicRedirect({ identity }: { identity: SnapshotIdentity }) {
  const navigate = useNavigate()
  const { kind, appId } = identity
  // Exactly `{ kind, appId }`: Convex validators reject extra fields.
  const result = useQuery(api.publicSheet.get, { kind, appId })
  const isPublic = result !== undefined && result !== null

  useEffect(() => {
    if (!isPublic) return
    // `replace`, so Back leaves the redirect rather than bouncing into it.
    void navigate({ to: '/p/$kind/$appId', params: { kind, appId }, replace: true })
  }, [isPublic, navigate, kind, appId])

  // `undefined` is still loading; `null` is "not public" (or no such entity).
  if (result === null) return <RetiredShareLink />
  // Loading, or public and about to be replaced by the public sheet.
  return <SheetSkeleton />
}

export function SnapshotLinkView({ identity }: { identity: SnapshotIdentity | null }) {
  // No server holds public sheets in a permanently-Solo build, so there is
  // nothing for any link to resolve to.
  if (identity === null || !isConvexConfigured) return <RetiredShareLink />
  return <PublicRedirect identity={identity} />
}
