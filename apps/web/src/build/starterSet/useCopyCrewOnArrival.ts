/**
 * The whole crew's copy, asked for: the confirm both the Starter Set page's
 * "Copy the crew to…" (`CopyCrew.tsx`) and an arrival with `?copy=crew` open.
 */

import { SHELF } from 'game-domain/container'
import { PRODUCT } from 'game-domain/product'
import { useEffect, useRef } from 'react'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { useConnection } from '../../lib/connection/connectionContext'
import type { moveDestinations } from '../../lib/games/gameRoster'
import { copyStarterCrew } from '../../lib/starterSet/copyStarter'
import { STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'

/** The search that asks the page to offer the crew copy on arrival. */
export const COPY_CREW_SEARCH = 'crew'

type Destination = ReturnType<typeof moveDestinations>[number]

/** Ask, then copy the crew into `target`. */
export function confirmCopyCrew(confirm: Confirm, target: Destination) {
  confirm({
    title: `Copy the whole crew to ${target.label}?`,
    body: [
      `This puts all six Pilots, their Mechs and Crawler #430 'Tenacity' in ${target.label}, each a build of your own, crewed and docked as the Starter Set has them.`,
      `The Starter Set stays as ${STARTER_SET_PUBLISHER} published it. Don't want a copy later? Delete it like any other build.`,
    ],
    confirmLabel: 'Copy the crew',
    pendingLabel: 'Copying…',
    tone: 'default',
    failure: 'The crew could not be copied. Try again.',
    onConfirm: async () => {
      const { builds } = await copyStarterCrew(target.container)
      toast.success(`Copied ${builds} builds to ${target.label}.`)
    },
  })
}

/**
 * Arriving with `?copy=crew` signed in, offer the crew copy into the Training
 * Bay once: the one destination every account has. Signed out the band's
 * control signs in and comes back here.
 */
export function useCopyCrewOnArrival(copy: string | undefined, confirm: Confirm) {
  const { mode } = useConnection()
  const offered = useRef(false)
  useEffect(() => {
    if (offered.current || copy !== COPY_CREW_SEARCH || mode !== 'connected') return
    offered.current = true
    confirmCopyCrew(confirm, { container: SHELF, label: PRODUCT.build })
  }, [copy, mode, confirm])
}
