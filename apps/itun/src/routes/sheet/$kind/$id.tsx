/**
 * Sheet view route — /sheet/:kind/:id — the one way to view an entity.
 *
 * kind: 'pilot' | 'mech' | 'crawler'
 * id:   the entity's app id (what every in-app link carries)
 *
 * Editable when it is yours, read-only and live when it is a crewmate's: the
 * page body (`SheetView`) decides. The loader hydrates the entity store for all
 * kinds and SoftLinks so composition mode resolution (and linked-entity rails)
 * works synchronously in Sheet.tsx.
 *
 * Unknown kinds throw TanStack's notFound() and render the styled
 * SheetKindNotFound component (plan 2.8) instead of an unstyled router error.
 */

import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundPanel } from '../../../components/shared/RouteFallbacks'
import { SheetSkeleton } from '../../../components/sheet/SheetSkeleton'
import { SheetView } from '../../../components/sheet/SheetView'
import { pageTitle } from '../../../lib/pageTitle'
import type { SheetEntityKind } from '../../../lib/schemas/entity'
import { useEntityStore } from '../../../stores/entityStore'

/**
 * A sheet kind is exactly a store-entity kind. Partners are NOT among them:
 * one renders in place on its host's sheet as a decorated reference entity, so
 * it never needed a route, and `EntityRef` never needed widening (ADR-028).
 */
type SheetKind = SheetEntityKind

const VALID_KINDS: SheetKind[] = ['pilot', 'mech', 'crawler']

/** Route-param guard: narrows the raw `$kind` segment to a sheet kind. */
function isSheetKind(kind: string): kind is SheetKind {
  return VALID_KINDS.some((k) => k === kind)
}

function SheetKindNotFound() {
  const params = Route.useParams()
  return (
    <NotFoundPanel
      title="Sheet not found"
      message={
        <>
          &ldquo;{params.kind}&rdquo; is not a sheet type. Sheets exist for pilots, mechs, and
          crawlers.
        </>
      }
    />
  )
}

export const Route = createFileRoute('/sheet/$kind/$id')({
  loader: async ({ params }) => {
    if (!isSheetKind(params.kind)) {
      throw notFound()
    }
    const store = useEntityStore.getState()
    // Hydrate ALL entity kinds (not just the viewed one): wired compositions
    // resolve linked entities (rail chips, Hold ← Load targets) from the
    // other kinds' stores via SoftLinks.
    await Promise.all([
      store.hydrate('pilot'),
      store.hydrate('mech'),
      store.hydrate('crawler'),
      store.hydrate('softLink'),
    ])
  },
  // The generic title. The entity's own name comes from the store in
  // `SheetView`, so the tab follows a rename: a loader reads no player entity.
  head: () => ({ meta: [{ title: pageTitle('Sheet') }] }),
  component: SheetPage,
  pendingComponent: SheetSkeleton,
  notFoundComponent: SheetKindNotFound,
})

function SheetPage() {
  const { kind, id } = Route.useParams()
  // The loader already 404s unknown kinds; this re-narrow keeps it cast-free.
  if (!isSheetKind(kind)) return <SheetKindNotFound />

  return <SheetView kind={kind} id={id} />
}
