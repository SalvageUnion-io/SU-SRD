/**
 * A mech's companion's own sheet,
 * /mechs/:id/companions/:partnerId. The companion stays an entry of the
 * mech's `partners`; this only gives it a page (`CompanionSheet`).
 */
import { createFileRoute } from '@tanstack/react-router'
import { CompanionSheet } from '../../../build/dash/CompanionSheet'
import { SheetSkeleton } from '../../../build/sheet/SheetSkeleton'
import { loadSheet, sheetHead } from '../../../lib/sheetRoute'

export const Route = createFileRoute('/mechs/$id_/companions/$partnerId')({
  loader: loadSheet,
  head: sheetHead,
  component: MechCompanionPage,
  pendingComponent: SheetSkeleton,
})

function MechCompanionPage() {
  const { id, partnerId } = Route.useParams()
  return <CompanionSheet hostKind="mech" hostId={id} partnerId={partnerId} />
}
