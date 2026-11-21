/**
 * A saved NPC's redesign — /npcs/:id/design (ADR-044): the designer opened on
 * that NPC, saving in place. Who may is asked live in the component
 * (`NpcRedesignPage`): loaders never read player entities.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { NpcRedesignPage } from '../../../build/npc/NpcRedesignPage'
import { SheetSkeleton } from '../../../build/sheet/SheetSkeleton'
import { areaTitle } from '../../../lib/pageTitle'
import { loadSheet } from '../../../lib/sheetRoute'
import { routesCopy } from '../../../messages/routes'

export const Route = createFileRoute('/npcs/$id_/design')({
  loader: loadSheet,
  head: () => ({
    meta: [{ title: areaTitle(routesCopy('mediatorsKit'), routesCopy('editDesign')) }],
  }),
  component: NpcDesignPage,
  pendingComponent: SheetSkeleton,
})

function NpcDesignPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const toSheet = () => void navigate({ to: '/npcs/$id', params: { id } })
  return <NpcRedesignPage id={id} onSaved={toSheet} onCancel={toSheet} />
}
