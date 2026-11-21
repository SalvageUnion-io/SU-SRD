/**
 * A built NPC's sheet — /npcs/:id, its app id (ADR-044): a page of its own
 * (`NpcSheetView`), not the composed Live Sheet. Shared with the other sheet
 * routes: `lib/sheetRoute.ts`.
 */
import { createFileRoute } from '@tanstack/react-router'
import { NpcSheetView } from '../../build/npc/NpcSheetView'
import { SheetSkeleton } from '../../build/sheet/SheetSkeleton'
import { areaTitle } from '../../lib/pageTitle'
import { loadSheet } from '../../lib/sheetRoute'
import { routesCopy } from '../../messages/routes'

export const Route = createFileRoute('/npcs/$id')({
  loader: loadSheet,
  // The NPC's own name follows from the store (`useLocatedSheet`); it is the Mediator's Kit's.
  head: () => ({ meta: [{ title: areaTitle(routesCopy('mediatorsKit'), routesCopy('npc')) }] }),
  component: NpcSheetPage,
  pendingComponent: SheetSkeleton,
})

function NpcSheetPage() {
  const { id } = Route.useParams()
  return <NpcSheetView id={id} />
}
