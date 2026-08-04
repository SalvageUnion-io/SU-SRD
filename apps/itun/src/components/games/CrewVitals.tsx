import { Text } from 'component-lib'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { UNCLAIMED_LABEL } from '../../lib/ownership/ownerChip'
import { ConvexPending } from '../shared/ConvexPending'
import { NUM, ROW, SECTION } from './gameChrome'

/**
 * The crew strip: everybody's vitals, live.
 *
 * Reads `crew.vitals` rather than the full entity listing — that query exists
 * precisely so this component can re-render on every point of damage without
 * dragging loadouts and cargo down the wire with it.
 *
 * **Unclaimed reads as a state, not a blank.** A pre-gen waiting to be handed
 * out is a useful, normal thing; an empty owner cell would make it look broken
 * instead of available.
 *
 * A null vital renders as `—`, never `0`. The bodies are opaque on the server,
 * so a missing field means "we do not know", and showing zero would read as
 * *dead* on a vitals strip.
 */
export function CrewVitals({ gameId }: { gameId: Id<'games'> }) {
  const crew = useQuery(api.crew.vitals, { gameId })

  if (crew === undefined) return <ConvexPending label="the crew" />

  const owner = (name: string | null, ownerId: string | null) =>
    ownerId === null ? UNCLAIMED_LABEL : (name ?? 'Crewmate')

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Text as="span" className={SECTION}>
          Pilots
        </Text>
        {crew.pilots.length === 0 && <Text variant="hint">No pilots in this game yet.</Text>}
        {crew.pilots.map((p) => (
          <div key={p._id} className={ROW}>
            <Text as="span">{p.name}</Text>
            <span className="flex items-baseline gap-3">
              <Text as="span" variant="hint">
                {owner(p.ownerName, p.ownerId)}
              </Text>
              <Text as="span" className={NUM}>
                HP {p.currentHP ?? '—'} · AP {p.currentAP ?? '—'}
              </Text>
            </span>
          </div>
        ))}
      </div>

      <div>
        <Text as="span" className={SECTION}>
          Mechs
        </Text>
        {crew.mechs.length === 0 && <Text variant="hint">No mechs in this game yet.</Text>}
        {crew.mechs.map((m) => (
          <div key={m._id} className={ROW}>
            <Text as="span">{m.name}</Text>
            <span className="flex items-baseline gap-3">
              <Text as="span" variant="hint">
                {owner(m.ownerName, m.ownerId)}
              </Text>
              <Text as="span" className={NUM}>
                SP {m.currentSP ?? '—'} · Heat {m.currentHeat ?? '—'}
              </Text>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
