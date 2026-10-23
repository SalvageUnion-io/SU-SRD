/**
 * A crawler's sheet — /crawlers/:id, its app id. Editable when it is yours, read-only
 * and live when it is a crewmate's: the page body (`SheetView`) decides.
 * Shared with the other sheet routes: `lib/sheetRoute.ts`.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SheetSkeleton } from '../../build/sheet/SheetSkeleton'
import { SheetView } from '../../build/sheet/SheetView'
import { loadSheet, sheetHead } from '../../lib/sheetRoute'

export const Route = createFileRoute('/crawlers/$id')({
  loader: loadSheet,
  head: sheetHead,
  component: CrawlerSheetPage,
  pendingComponent: SheetSkeleton,
})

function CrawlerSheetPage() {
  const { id } = Route.useParams()
  return <SheetView kind="crawler" id={id} />
}
