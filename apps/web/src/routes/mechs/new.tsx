import { createFileRoute } from '@tanstack/react-router'
import { MechWizard } from '../../build/mech/MechWizard'
import { NewUnitRoute } from '../../build/wizard/NewUnitRoute'
import { newUnitHead, newUnitSearch } from '../../lib/newUnitRoute'
import { preselectedChassis, preselectedPattern } from '../../lib/wizard/preselect'

export const Route = createFileRoute('/mechs/new')({
  head: () => newUnitHead('New Mech'),
  // pattern: the chassis's pattern slug, from an SRD pattern page's "Build With This"
  validateSearch: (search: Record<string, unknown>) => newUnitSearch(search, 'chassis', 'pattern'),
  component: NewMechRoute,
})

function NewMechRoute() {
  const search = Route.useSearch()
  return (
    <NewUnitRoute
      kind="mech"
      search={search}
      wizard={(props) => (
        <MechWizard
          {...props}
          preselectChassis={preselectedChassis(search.chassis)}
          preselectPattern={preselectedPattern(search.chassis, search.pattern)}
        />
      )}
    />
  )
}
