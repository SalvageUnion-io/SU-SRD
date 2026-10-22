/**
 * One encounter — /encounters/:id — the Mediator's prep (ADR-053), on its
 * owner's shelf. The loader waits for the encounters, and the patterns its
 * picker fields; the page reads them from the stores.
 */

import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { EncounterPage } from '../../build/prep/EncounterPage'
import { RosterSkeleton } from '../../components/index'
import { areaTitle } from '../../lib/pageTitle'
import { usePatternStore } from '../../stores/patternStore'
import { usePrepStore } from '../../stores/prepStore'

export const Route = createFileRoute('/encounters/$id')({
  loader: async () => {
    await Promise.all([usePrepStore.getState().hydrate(), usePatternStore.getState().hydrate()])
  },
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Encounter') }] }),
  component: EncounterRoute,
  pendingComponent: RosterSkeleton,
})

function EncounterRoute() {
  const { id } = Route.useParams()
  return <EncounterPage id={id} />
}
