/**
 * /encounters/add?from=<schema>:<slug> — field a Reference denizen in one of
 * the reader's encounters (its page's "Add to an encounter", ADR-067 §3).
 */

import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { AddToEncounterPage } from '../../build/prep/AddToEncounterPage'
import { RosterSkeleton } from '../../components/app'
import { areaTitle } from '../../lib/pageTitle'
import { buildPrepCopy } from '../../messages/build-prep'

export const Route = createFileRoute('/encounters/add')({
  validateSearch: (search: Record<string, unknown>): { from: string } => ({
    from: typeof search.from === 'string' ? search.from : '',
  }),
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, buildPrepCopy('addToAnEncounter')) }] }),
  component: AddRoute,
  pendingComponent: RosterSkeleton,
})

function AddRoute() {
  const { from } = Route.useSearch()
  const [schema = '', slug = ''] = from.split(':')
  return <AddToEncounterPage schema={schema} slug={slug} />
}
