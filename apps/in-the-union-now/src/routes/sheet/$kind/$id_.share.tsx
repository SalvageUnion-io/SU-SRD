/**
 * Share Snapshot route — /sheet/:kind/:id/share (design §3.4, plan 5.2).
 *
 * The `$id_` segment opts out of nesting under the sheet view route (same
 * pattern as /pilots/$id_/edit). Unknown kinds 404 with the same styled
 * component as the sheet route; the loader hydrates only the shared kind —
 * the preview is a bare-entity card, no composition resolution needed.
 */

import { createFileRoute, notFound } from '@tanstack/react-router'

import { ShareSnapshotScreen } from '../../../components/sheet/ShareSnapshotScreen'
import { AppLink } from '../../../components/shared/AppLink'
import { buttonVariants } from '../../../components/ui/buttonVariants'
import type { EntityRef } from '../../../lib/schemas/entity'
import { cn } from '../../../lib/utils'
import { useEntityStore } from '../../../stores/entityStore'

const VALID_KINDS: EntityRef['type'][] = ['pilot', 'mech', 'crawler']

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
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
      >
        &larr; Back to dashboard
      </AppLink>
    </main>
  )
}

export const Route = createFileRoute('/sheet/$kind/$id_/share')({
  loader: async ({ params }) => {
    const kind = params.kind as EntityRef['type']
    if (!VALID_KINDS.includes(kind)) {
      throw notFound()
    }
    await useEntityStore.getState().hydrate(kind)
  },
  component: SharePage,
  notFoundComponent: ShareKindNotFound,
})

function SharePage() {
  const { kind, id } = Route.useParams()
  return <ShareSnapshotScreen kind={kind as EntityRef['type']} id={id} />
}
