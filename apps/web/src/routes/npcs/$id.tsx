/**
 * A built NPC's sheet — /npcs/:id, its app id (ADR-044): a page of its own
 * (`NpcSheetView`), not the composed Live Sheet. Shared with the other sheet
 * routes: `lib/sheetRoute.ts`.
 */
import { createFileRoute } from '@tanstack/react-router'
import { NpcSheetView } from '../../build/npc/NpcSheetView'
import { SheetSkeleton } from '../../build/sheet/SheetSkeleton'
import { loadSheet, sheetHead } from '../../lib/sheetRoute'

export const Route = createFileRoute('/npcs/$id')({
  loader: loadSheet,
  head: sheetHead,
  component: NpcSheetPage,
  pendingComponent: SheetSkeleton,
})

function NpcSheetPage() {
  const { id } = Route.useParams()
  return <NpcSheetView id={id} />
}
