/**
 * useSalvageArea — the area a table is salvaging (Core Book p.245): its Tech
 * Level and the Supply it has left, read live (`salvageAreas.here`) by every
 * seat at the place, a Game's or the solo table's.
 *
 * In a Game its Mediator names the area (`canSet`); solo, the player is their
 * own Mediator. Each Area Salvage roll spends 1 Supply on the server first
 * (`spend`), and rolls only once the spend lands, so two players never roll
 * the last Supply twice. Writes go through `useGuardedWrite`: refused while
 * they cannot go, and a refusal ("This area is picked clean") said in the
 * server's own words.
 */

import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useGuardedWrite } from '../lib/connection/useGuardedWrite'
import { isSignedIn } from '../replica/sync'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'
import type { PlayScreen } from './play.model'

export type SalvageAreaView = {
  /** The area being salvaged; null when there is none (or before the first answer). */
  area: SalvageArea | null
  /** Whether this screen names the area: the Mediator in a Game, the player solo. */
  canSet: boolean
  set: (area: SalvageArea | null) => void
  /** Spend 1 Supply for one roll by `pilotId`: the Tech Level it was spent on, or null when refused. */
  spend: (pilotId: string) => Promise<{ techLevel: number; supply: number } | null>
}

export function useSalvageArea(screen: PlayScreen): SalvageAreaView {
  const signedIn = isSignedIn(useSync().status)
  const guarded = useGuardedWrite()
  const gameId = screen.gameId as Id<'games'> | null
  const here = useTableRead(api.salvageAreas.here, signedIn ? { gameId } : 'skip')
  const setArea = useTableAct(api.salvageAreas.set, gameId)
  const spendSupply = useTableAct(api.salvageAreas.spend, gameId)

  return {
    area: here ?? null,
    canSet: gameId === null || screen.mediator,
    set: (area) => guarded.send(() => setArea({ gameId, area })),
    spend: async (pilotId) => {
      let spent: { techLevel: number; supply: number } | null = null
      const ok = await guarded.ask(async () => {
        spent = await spendSupply({ gameId, pilotId })
        return true
      })
      return ok ? spent : null
    },
  }
}
