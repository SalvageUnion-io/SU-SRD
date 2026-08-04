/**
 * Share Snapshot route — /sheet/:kind/:id/share (design §3.4, plan 5.2).
 *
 * The `$id_` segment opts out of nesting under the sheet view route (same
 * pattern as /pilots/$id_/edit). Unknown kinds 404 with the same styled
 * component as the sheet route; the loader hydrates only the shared kind —
 * the preview is a bare-entity card, no composition resolution needed.
 */

import { createFileRoute, notFound } from '@tanstack/react-router'
import { buttonVariants } from 'component-lib'
import { AppLink } from '../../../components/shared/AppLink'
import { ShareSnapshotScreen } from '../../../components/sheet/ShareSnapshotScreen'
import type { EntityRef } from '../../../lib/schemas/entity'
import { cn } from '../../../lib/utils'
import { useEntityStore } from '../../../stores/entityStore'

const VALID_KINDS: EntityRef['type'][] = ['pilot', 'mech', 'crawler']

/** Route-param guard: narrows the raw `$kind` segment to a sheet kind. */
function isSheetKind(kind: string): kind is EntityRef['type'] {
  return VALID_KINDS.some((k) => k === kind)
}

function ShareKindNotFound() {
  const params = Route.useParams()
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-xl font-bold">Nothing to share</h1>
      <p className="text-wk-muted mb-4 text-sm">
        &ldquo;{params.kind}&rdquo; is not a sheet type. Snapshots exist for pilots, mechs, and
        crawlers.
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

export const Route = createFileRoute('/sheet/$kind/$id_/share')({
  loader: async ({ params }) => {
    if (!isSheetKind(params.kind)) {
      throw notFound()
    }
    await useEntityStore.getState().hydrate(params.kind)
  },
  component: SharePage,
  notFoundComponent: ShareKindNotFound,
})

function SharePage() {
  const { kind, id } = Route.useParams()
  // The loader already 404s unknown kinds; this re-narrow keeps it cast-free.
  if (!isSheetKind(kind)) return <ShareKindNotFound />
  return <ShareSnapshotScreen kind={kind} id={id} />
}
