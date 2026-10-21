/**
 * Sheet view route — /sheet/:kind/:id — the one way to view an entity.
 *
 * kind: 'pilot' | 'mech' | 'crawler' | 'npc'
 * id:   the entity's app id (what every in-app link carries)
 *
 * A built NPC (ADR-044) has a page of its own (`NpcSheetView`); the other
 * three render the composed Live Sheet.
 *
 * Editable when it is yours, read-only and live when it is a crewmate's: the
 * page body (`SheetView`) decides. The loader hydrates the entity store for all
 * kinds and SoftLinks so composition mode resolution (and linked-entity rails)
 * works synchronously in Sheet.tsx.
 *
 * Unknown kinds throw TanStack's notFound() and render the styled
 * SheetKindNotFound component instead of an unstyled router error.
 */

import { createFileRoute, notFound } from '@tanstack/react-router'
import { isEntityKind } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import { NpcSheetView } from '../../../build/npc/NpcSheetView'
import { SheetSkeleton } from '../../../build/sheet/SheetSkeleton'
import { SheetView } from '../../../build/sheet/SheetView'
import { NotFoundPanel } from '../../../components/shared/RouteFallbacks'
import { areaTitle } from '../../../lib/pageTitle'
import { useEntityStore } from '../../../stores/entityStore'

/*
 * The route's `$kind` is any store-entity kind (`isEntityKind`), NPCs
 * included. Partners are NOT among them: one renders in place on its host's
 * sheet as a decorated reference entity, so it never needed a route, and
 * `EntityRef` never needed widening (ADR-028).
 */

function SheetKindNotFound() {
  const params = Route.useParams()
  return (
    <NotFoundPanel
      title="Sheet not found"
      message={
        <>
          &ldquo;{params.kind}&rdquo; is not a sheet type. Sheets exist for pilots, mechs, crawlers
          and NPCs.
        </>
      }
    />
  )
}

export const Route = createFileRoute('/sheet/$kind/$id')({
  loader: async ({ params }) => {
    if (!isEntityKind(params.kind)) {
      throw notFound()
    }
    const store = useEntityStore.getState()
    // Hydrate ALL entity kinds (not just the viewed one): wired compositions
    // resolve linked entities (rail chips, Hold Load targets) from the
    // other kinds' stores via SoftLinks.
    await Promise.all([
      store.hydrate('pilot'),
      store.hydrate('mech'),
      store.hydrate('crawler'),
      store.hydrate('npc'),
      store.hydrate('softLink'),
    ])
  },
  // The generic title. The entity's own name comes from the store in
  // `SheetView`, so the tab follows a rename: a loader reads no player entity.
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Sheet') }] }),
  component: SheetPage,
  pendingComponent: SheetSkeleton,
  notFoundComponent: SheetKindNotFound,
})

function SheetPage() {
  const { kind, id } = Route.useParams()
  // The loader already 404s unknown kinds; this re-narrow keeps it cast-free.
  if (!isEntityKind(kind)) return <SheetKindNotFound />
  if (kind === 'npc') return <NpcSheetView id={id} />

  return <SheetView kind={kind} id={id} />
}
