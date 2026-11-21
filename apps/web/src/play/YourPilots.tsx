/**
 * YourPilots — the Games hub's "Your pilots" strip: every pilot of yours, in a
 * Game or not, each with its Play door, so the header's Play always has
 * something to play. Play runs a pilot solo or at a table (ADR-066); a Game is
 * needed for neither this strip nor the door.
 *
 * It is the Training Bay's own Ledger (`ShelfLedger`) with a Play door a line:
 * the pilot by callsign then name (`pilotLabel`), their Class, the mech they
 * fly and the Game they are in. Nothing here makes or keeps a unit (ADR-052
 * §3): each name opens its sheet in Build, and bare, the strip says Play works
 * solo and offers the way to build one.
 */

import { cockpitPath } from 'game-domain/entityKinds'
import { pilotCallsign, pilotLabel } from 'game-domain/pilotLabel'
import { ShelfLedger } from '../build/shelves/ShelfLedger'
import { inGame, paired } from '../build/shelves/shelfColumns'
import { Button } from '../components/index'
import { useHydrateEntities, useOwnUnits, useSoftLinkList } from '../lib/entities'
import type { ShelfGame } from '../lib/shelves/shelfItems'
import { crewLinked, gameRelation, pilotFact } from '../lib/shelves/shelfItems'
import { playCopy } from '../messages/play'
import { useSync } from '../replica/syncContext'

const COLUMNS = [
  { key: 'class', label: playCopy('pilotClass'), kind: 'text', phone: true },
  { key: 'mech', label: playCopy('kindMech'), kind: 'text' },
  { key: 'game', label: playCopy('game'), kind: 'text' },
] as const

export function YourPilots({ games }: { games: readonly ShelfGame[] | undefined }) {
  useHydrateEntities(['pilot', 'mech', 'softLink'])
  const { canWrite } = useSync()
  const pilots = useOwnUnits('pilot')
  const mechs = useOwnUnits('mech')
  const softLinks = useSoftLinkList()
  const mechNames = new Map(mechs.map((m) => [m.id, m.name]))

  return (
    <ShelfLedger
      id="play-pilots"
      title={playCopy('yourPilots')}
      tone="pilot"
      columns={COLUMNS}
      action={
        canWrite ? (
          <Button href="/pilots/new" variant="default" size="compact">
            {playCopy('newPilot')}
          </Button>
        ) : undefined
      }
      empty={playCopy('noPilotsPlayWorksSolo')}
      rows={pilots.map((p) => ({
        id: p.id,
        name: pilotLabel(p),
        href: `/pilots/${p.id}`,
        cells: [
          pilotFact(p) ?? '',
          paired(crewLinked({ kind: 'pilot', id: p.id, softLinks, names: mechNames })),
          inGame(gameRelation(p, games ? [...games] : undefined)),
        ],
        menu: [],
        play: cockpitPath(p.id),
        // A pilot's door says who it plays (glossary §9).
        playLabel: playCopy('playPilot', { name: pilotCallsign(p) }),
      }))}
    />
  )
}
