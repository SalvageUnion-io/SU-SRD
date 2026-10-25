/**
 * Play route — /play/pilots/:pilotId
 *
 * Play runs one pilot of yours, in a Game or solo, on the Cockpit
 * (`PlayCockpit`). An old mech-keyed URL lands here too (from the retired
 * `/dashboard/:id`) and is redirected to the mech's pilot.
 *
 * The loader only hydrates every entity kind and the soft links, mirroring the
 * sheet route, so the pilot and its mech and crawler resolve synchronously.
 * Who may play is not decided here: loaders never read player entities
 * (`.claude/rules/tanstack-router.md`), and the check has to stay live, so
 * `PlayGate` decides it in the component. For the same reason the title
 * carries no pilot name.
 */

import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { areaTitle } from '../../../lib/pageTitle'
import { PlayGate } from '../../../play/PlayGate'
import { useUnits } from '../../../replica/units'

export const Route = createFileRoute('/play/pilots/$pilotId')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.play, 'Play') }] }),
  loader: async () => {
    const store = useUnits.getState()
    await Promise.all([
      store.hydrate('mech'),
      store.hydrate('pilot'),
      store.hydrate('crawler'),
      store.hydrate('softLink'),
    ])
  },
  component: PlayPage,
})

function PlayPage() {
  const { pilotId } = Route.useParams()
  return <PlayGate id={pilotId} />
}
