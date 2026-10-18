/**
 * usePlaySeat — the seat Play runs (play.md §3): the Game's, or with no Game
 * the pilot's solo seat (`seats.solo`, writes with `gameId` null). The same
 * reads, writes and optimistic updates as a Game's seat (`useSeatAt`).
 */

import type { Id } from '../../convex/_generated/dataModel'
import type { PlayTarget } from './play.model'
import type { SeatHandle } from './useSeat'
import { useSeatAt } from './useSeat'

export function usePlaySeat(target: Pick<PlayTarget, 'gameId' | 'pilotId'>): SeatHandle {
  return useSeatAt({
    gameId: target.gameId as Id<'games'> | null,
    pilotId: target.pilotId,
    solo: true,
  })
}
