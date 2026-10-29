import { createFileRoute } from '@tanstack/react-router'
import { PilotWizard } from '../../build/pilot/PilotWizard'
import { NewUnitRoute } from '../../build/wizard/NewUnitRoute'
import { newUnitHead, newUnitSearch } from '../../lib/newUnitRoute'
import { preselectedClassId } from '../../lib/wizard/preselect'
import { routesCopy } from '../../messages/routes'

export const Route = createFileRoute('/pilots/new')({
  head: () => newUnitHead(routesCopy('newPilot')),
  validateSearch: (search: Record<string, unknown>) => newUnitSearch(search, 'class'),
  component: NewPilotRoute,
})

function NewPilotRoute() {
  const search = Route.useSearch()
  return (
    <NewUnitRoute
      kind="pilot"
      search={search}
      wizard={(props) => (
        <PilotWizard {...props} preselectClassId={preselectedClassId(search.class)} />
      )}
    />
  )
}
