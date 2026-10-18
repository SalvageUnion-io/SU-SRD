import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { Roster } from '../build/roster/Roster'
import { areaTitle } from '../lib/pageTitle'

/**
 * `/` — the Hangar: everything you own, in a Game or not (ADR-052 §1). Signed
 * out it is the front door.
 */
export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Hangar') }] }),
  component: IndexPage,
})

function IndexPage() {
  return <Roster />
}
