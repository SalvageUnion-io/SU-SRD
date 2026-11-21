import { createFileRoute } from '@tanstack/react-router'
import { PilotWizard } from '../../build/pilot/PilotWizard'
import { NewUnitRoute } from '../../build/wizard/NewUnitRoute'
import { newUnitHead, newUnitSearch } from '../../lib/newUnitRoute'
import { parseGameParam } from '../../lib/wizard/fromGame'
import { preselectedClassId } from '../../lib/wizard/preselect'
import { routesCopy } from '../../messages/routes'

export const Route = createFileRoute('/pilots/new')({
  head: () => newUnitHead(routesCopy('newPilot')),
  // mech: the mech it is made for, from that mech's "No Pilot" place
  validateSearch: (search: Record<string, unknown>) => ({
    ...newUnitSearch(search, 'class'),
    // A mech's id is a UUID, as a Game's is: the same narrowing.
    mech: parseGameParam(search.mech),
  }),
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
