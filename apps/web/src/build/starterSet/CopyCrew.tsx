/**
 * "Copy the crew to…" — the Starter Set page's band control: the whole crew,
 * every Pilot, Mech and the Tenacity, copied in one go into a container the
 * player picks, linked to one another as the box links them
 * (`copyStarterCrew`). One build at a time is each Compact's "Copy to…".
 *
 * The destinations are the crawler's (`moveDestinations`): the Training Bay,
 * or a Game the player runs, since only a table's runner may bring a crawler
 * to it (ADR-037). Pilots and mechs may go wherever the crawler may.
 *
 * Signed out, the same place signs in first and comes back with `?copy=crew`,
 * which the page answers by offering the Training Bay copy at once
 * (`useCopyCrewOnArrival.ts`): the Starter Set landing's "Take the crew" step
 * links there, so a box owner reaches a crew of their own in one tap after
 * signing in. Offline it is absent, as every write is.
 */

import { useQuery } from 'convex/react'
import { SHELF } from 'game-domain/container'
import { api } from '../../../convex/_generated/api'
import { HeaderMenu } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { useConnection } from '../../lib/connection/connectionContext'
import { moveDestinations } from '../../lib/games/gameRoster'
import { SignInControl } from '../account/SignInControl'
import { serializeContainer } from '../entityContainer/containerKey.model'
import { COPY_CREW_SEARCH, confirmCopyCrew } from './useCopyCrewOnArrival'

/** Where signing in from this control comes back to. */
const COPY_CREW_RETURN = `/starter?copy=${COPY_CREW_SEARCH}`

function ConnectedCopyCrew({ confirm }: { confirm: Confirm }) {
  const games = useQuery(api.games.listMine)
  const destinations = moveDestinations({ kind: 'crawler', current: SHELF, games: games ?? [] })
  return (
    <HeaderMenu
      variant="button"
      size="compact"
      trigger="Copy the crew to…"
      label="Copy the whole crew to…"
      sections={[
        destinations.map((d) => ({
          id: serializeContainer(d.container),
          label: d.label,
          onSelect: () => confirmCopyCrew(confirm, d),
        })),
      ]}
    />
  )
}

export function CopyCrew({ confirm }: { confirm: Confirm }) {
  const { mode } = useConnection()
  if (mode === 'solo') {
    return (
      <SignInControl
        label="Sign in to copy the crew"
        redirectTo={COPY_CREW_RETURN}
        size="compact"
      />
    )
  }
  if (mode !== 'connected') return null
  return <ConnectedCopyCrew confirm={confirm} />
}
