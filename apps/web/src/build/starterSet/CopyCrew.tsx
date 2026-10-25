/**
 * "Copy the crew to…" — the Starter Set page's band control: the whole crew,
 * every Pilot, Mech and the Tenacity, copied in one go into a container the
 * player picks, linked to one another as the box links them
 * (`copyStarterCrew`). One build at a time is each Compact's "Copy to…".
 *
 * The destinations are the crawler's (`moveDestinations`): the Training Bay,
 * or a Game the player runs, since only a table's runner may bring a crawler
 * to it (ADR-037). Pilots and mechs may go wherever the crawler may. A crew
 * with no crawler (the Quickstart's) goes wherever a pilot may.
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
import { moveDestinations } from '../../lib/games/gameRoster'
import type { StarterRosterId } from '../../lib/starterSet/starterTemplates'
import { starterRoster } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { useSync } from '../../replica/syncContext'
import { SignInControl } from '../account/SignInControl'
import { serializeContainer } from '../entityContainer/containerKey.model'
import { confirmCopyCrew, copyCrewSearch } from './useCopyCrewOnArrival'

/** Where signing in from this control comes back to: the page, offering this crew's copy. */
const copyCrewReturn = (roster: StarterRosterId) => `/starter?copy=${copyCrewSearch(roster)}`

type CopyCrewProps = { confirm: Confirm; roster?: StarterRosterId }

function ConnectedCopyCrew({ confirm, roster = 'starter-set' }: CopyCrewProps) {
  const games = useQuery(api.games.listMine)
  const kind = starterRoster(roster).crawlers.length > 0 ? 'crawler' : 'pilot'
  const destinations = moveDestinations({ kind, current: SHELF, games: games ?? [] })
  return (
    <HeaderMenu
      variant="button"
      size="compact"
      trigger={buildStarterSetCopy('copyTheCrewTo')}
      label={buildStarterSetCopy('copyTheWholeCrewTo')}
      sections={[
        destinations.map((d) => ({
          id: serializeContainer(d.container),
          label: d.label,
          onSelect: () => confirmCopyCrew(confirm, d, roster),
        })),
      ]}
    />
  )
}

export function CopyCrew({ confirm, roster = 'starter-set' }: CopyCrewProps) {
  const { status } = useSync()
  if (status === 'signedOut') {
    return (
      <SignInControl
        label={buildStarterSetCopy('signInToCopyTheCrew')}
        redirectTo={copyCrewReturn(roster)}
        size="compact"
      />
    )
  }
  if (status !== 'live') return null
  return <ConnectedCopyCrew confirm={confirm} roster={roster} />
}
