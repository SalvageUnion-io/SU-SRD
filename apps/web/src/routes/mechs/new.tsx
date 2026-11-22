import { createFileRoute } from '@tanstack/react-router'
import { MechWizard } from '../../build/mech/MechWizard'
import { NewUnitRoute } from '../../build/wizard/NewUnitRoute'
import { newUnitHead, newUnitSearch } from '../../lib/newUnitRoute'
import { parseGameParam } from '../../lib/wizard/fromGame'
import { preselectedChassis, preselectedPattern } from '../../lib/wizard/preselect'
import { routesCopy } from '../../messages/routes'

export const Route = createFileRoute('/mechs/new')({
  head: () => newUnitHead(routesCopy('newMech')),
  // pattern: the chassis's pattern slug, from an SRD pattern page's "Build With This"
  // pilot: the pilot it is built for, from that pilot's line in the Training Bay
  validateSearch: (search: Record<string, unknown>) => ({
    ...newUnitSearch(search, 'chassis', 'pattern'),
    // A pilot's id is a UUID, as a Game's is: the same narrowing.
    pilot: parseGameParam(search.pilot),
    // From Play, a Mech built for its Pilot returns there (r5 B17).
    ...(search.back === 'play' ? { back: 'play' as const } : {}),
  }),
  component: NewMechRoute,
})

function NewMechRoute() {
  const search = Route.useSearch()
  return (
    <NewUnitRoute
      kind="mech"
      search={search}
      book={{ chassis: search.chassis, pattern: search.pattern }}
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
