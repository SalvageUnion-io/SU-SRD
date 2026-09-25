/**
 * ActiveItemBand — the Active Item (primary row): the entity you're currently
 * running, laid out as responsibility "bays" (a gauge cluster + its own button
 * grid), with a resolve overlay for player-confirmed steps.
 *
 * This file is only the dispatcher. It reads the mount state
 * (playStateStore) and hands off to one band per mount, each in its own file
 * (audit AP-16 — the three used to share one 1,100-line module):
 *
 *   - `MechBand` (Boarded) — reactor, damage, cargo, effects, egress.
 *   - `PilotBand` (On Foot) — vitals, damage, boarding.
 *   - `CrawlerBand` (Downtime) — the crawler economy and Leave.
 *
 * Each band runs its verbs through the pure rules engine (`dashboardRules.ts` /
 * `dashboardEconomy.ts` → `lib/rules/*`) and the entity store under the
 * ADR-007 automation boundary, then hands a pure `ActiveItemBandModel` to
 * `ActiveItemBandFrame`, which only renders it.
 *
 *   - Auto-apply (single click): Push, Heat Check, Vent, Shutdown toggle, the
 *     SP/HP value of a self-declared hit.
 *   - Player-confirmed (explicit extra step): the Critical Damage / Critical
 *     Injury *roll* when a hit hits 0, marking the mech Destroyed, and Eject.
 */

import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { EntityState } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { CrawlerBand } from './CrawlerBand'
import { MechBand } from './MechBand'
import { PilotBand } from './PilotBand'

/** The store surface the bands need — injectable so tests can assert patches. */
export type PlayStore = Pick<EntityState, 'get' | 'update' | 'transfer'>

type ActiveItemBandProps = {
  mech: Mech
  pilot: Pilot | null
  /** The linked crawler — the Active Item while in Downtime (Phase 6). */
  crawler?: Crawler | null
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

export function ActiveItemBand({ mech, pilot, crawler, store }: ActiveItemBandProps) {
  const mount = usePlayStateStore((s) => s.mount)
  const setMount = usePlayStateStore((s) => s.setMount)
  const leaveDowntime = usePlayStateStore((s) => s.leaveDowntime)
  // Unconditional hook; the prop wins when a stub is injected (tests / harness).
  const liveStore = useEntityStore()
  const s: PlayStore = store ?? liveStore

  if (mount === 'downtime' && crawler) {
    return <CrawlerBand crawler={crawler} mech={mech} store={s} onLeave={leaveDowntime} />
  }
  if (mount === 'pilot' && pilot) {
    return (
      <PilotBand
        pilot={pilot}
        crawler={crawler ?? null}
        store={s}
        onBoard={() => setMount('mech')}
      />
    )
  }
  return (
    <MechBand
      mech={mech}
      store={s}
      hasPilot={pilot !== null}
      pilotAbilities={pilot?.abilities}
      onDismount={() => setMount('pilot')}
    />
  )
}
