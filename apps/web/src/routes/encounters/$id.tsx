/**
 * One encounter — /encounters/:id — the Mediator's prep (ADR-059), on its
 * owner's shelf. The loader waits for the encounters, and the patterns its
 * picker fields; the page reads them from the stores.
 */

import { createFileRoute } from '@tanstack/react-router'
import { EncounterPage } from '../../build/prep/EncounterPage'
import { editSearch, useOpenInEdit } from '../../build/prep/useOpenInEdit'
import { RosterSkeleton } from '../../components/app'
import { areaTitle } from '../../lib/pageTitle'
import { routesCopy } from '../../messages/routes'
import { useEncounters, usePatterns } from '../../replica/collections'

export const Route = createFileRoute('/encounters/$id')({
  // From a Game's Prep it opens in Edit (r7 C13).
  validateSearch: editSearch,
  loader: async () => {
    await Promise.all([useEncounters.getState().hydrate(), usePatterns.getState().hydrate()])
  },
  head: () => ({
    meta: [{ title: areaTitle(routesCopy('mediatorsKit'), routesCopy('encounter')) }],
  }),
  component: EncounterRoute,
  pendingComponent: RosterSkeleton,
})

function EncounterRoute() {
  const { id } = Route.useParams()
  const { edit } = Route.useSearch()
  useOpenInEdit(edit)
  return <EncounterPage id={id} />
}
