/**
 * A pilot's sheet — /pilots/:id, its app id. Editable when it is yours, read-only
 * and live when it is a crewmate's: the page body (`SheetView`) decides.
 * Shared with the other sheet routes: `lib/sheetRoute.ts`.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SheetSkeleton } from '../../build/sheet/SheetSkeleton'
import { SheetView } from '../../build/sheet/SheetView'
import { loadSheet, sheetHead } from '../../lib/sheetRoute'

export const Route = createFileRoute('/pilots/$id')({
  loader: loadSheet,
  head: sheetHead,
  component: PilotSheetPage,
  pendingComponent: SheetSkeleton,
})

function PilotSheetPage() {
  const { id } = Route.useParams()
  return <SheetView kind="pilot" id={id} />
}
