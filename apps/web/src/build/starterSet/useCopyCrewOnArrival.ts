/**
 * The whole crew's copy, asked for: the confirm both the Starter Set page's
 * "Copy the crew to…" (`CopyCrew.tsx`) and an arrival with `?copy=crew` open.
 */

import { SHELF } from 'game-domain/container'
import { PRODUCT } from 'game-domain/product'
import { useEffect, useRef } from 'react'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import type { moveDestinations } from '../../lib/games/gameRoster'
import { copyStarterCrew } from '../../lib/starterSet/copyStarter'
import type { StarterRosterId } from '../../lib/starterSet/starterTemplates'
import { STARTER_SET_PUBLISHER, starterRoster } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { useSync } from '../../replica/syncContext'

/** The search that asks the page to offer the Starter Set crew's copy on arrival. */
const COPY_CREW_SEARCH = 'crew'

/** The `?copy=` that offers a crew's copy: `crew` for the Starter Set, a crew's id otherwise. */
export function copyCrewSearch(roster: StarterRosterId): string {
  return roster === 'starter-set' ? COPY_CREW_SEARCH : roster
}

function rosterOfSearch(copy: string | undefined): StarterRosterId | null {
  return copy === COPY_CREW_SEARCH ? 'starter-set' : copy === 'quickstart' ? copy : null
}

type Destination = ReturnType<typeof moveDestinations>[number]

/** Ask, then copy a crew (the Starter Set's by default) into `target`. */
export function confirmCopyCrew(
  confirm: Confirm,
  target: Destination,
  roster: StarterRosterId = 'starter-set'
) {
  confirm({
    title: buildStarterSetCopy('copyTheWholeCrew'),
    body: [
      roster === 'quickstart'
        ? buildStarterSetCopy('copyTheQuickstartCrewBody', { label: target.label })
        : buildStarterSetCopy('copyTheWholeCrewBody', { label: target.label }),
      buildStarterSetCopy('theStarterSetStaysAs', {
        crew: starterRoster(roster).name,
        publisher: STARTER_SET_PUBLISHER,
      }),
    ],
    confirmLabel: buildStarterSetCopy('copyTheCrew'),
    pendingLabel: buildStarterSetCopy('copying'),
    tone: 'default',
    failure: buildStarterSetCopy('theCrewCouldNotBe'),
    onConfirm: async () => {
      const { builds } = await copyStarterCrew(target.container, roster)
      toast.success(buildStarterSetCopy('copiedBuildsTo', { builds, label: target.label }))
    },
  })
}

/**
 * Arriving with `?copy=crew` (or `?copy=quickstart`) signed in, offer that
 * crew's copy into the Training Bay once: the one destination every account
 * has. Signed out a crew's control signs in and comes back here.
 */
export function useCopyCrewOnArrival(copy: string | undefined, confirm: Confirm) {
  const { status } = useSync()
  const offered = useRef(false)
  useEffect(() => {
    const roster = rosterOfSearch(copy)
    if (offered.current || roster === null || status !== 'live') return
    offered.current = true
    confirmCopyCrew(confirm, { container: SHELF, label: PRODUCT.build }, roster)
  }, [copy, status, confirm])
}
