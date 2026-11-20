/**
 * A pilot's companion's own sheet,
 * /pilots/:id/companions/:partnerId. The companion stays an entry of the
 * pilot's `partners`; this only gives it a page (`CompanionSheet`).
 */
import { createFileRoute } from '@tanstack/react-router'
import { CompanionSheet } from '../../../build/dash/CompanionSheet'
import { SheetSkeleton } from '../../../build/sheet/SheetSkeleton'
import { loadSheet, sheetHead } from '../../../lib/sheetRoute'

export const Route = createFileRoute('/pilots/$id_/companions/$partnerId')({
  loader: loadSheet,
  head: sheetHead,
  component: PilotCompanionPage,
  pendingComponent: SheetSkeleton,
})

function PilotCompanionPage() {
  const { id, partnerId } = Route.useParams()
  return <CompanionSheet hostKind="pilot" hostId={id} partnerId={partnerId} />
}
