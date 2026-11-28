/**
 * Rejoining a Game brings back what a removal took (r6 C7, `rooms/game/rejoin.ts`):
 * the units handed to the player's Training Bay go back to the Game, together
 * where they can (a pilot and their mech arrive still assigned), else each on
 * its own, and one no longer there (deleted, moved) stays where it is. The
 * room then gives back the pre-gens it kept and tells the table.
 */

import type { GameActAnswer } from '../../rooms/game/acts'
import type { LeftUnits } from '../../rooms/game/rejoin'
import type { UnitHome } from '../../rooms/handoff'
import { handOff, handOffTogether } from '../../rooms/handoff'
import type { GameRoomStub } from '../roomStubs'

export async function bringBack(
  room: GameRoomStub,
  account: UnitHome,
  gameId: string,
  actor: string,
  newId: () => string
): Promise<void> {
  const owed: GameActAnswer<LeftUnits> = await room.act(actor, 'returning', undefined as never)
  if (!owed.ok || (owed.value.moved.length === 0 && owed.value.kept.length === 0)) return
  const game = room as unknown as UnitHome
  const to = { kind: 'game', gameId } as const
  const move = (unitId: string) => ({ leaseId: newId(), unitId, actor, to, at: Date.now() })
  let moved: string[] = []
  try {
    await handOffTogether(account, game, owed.value.moved.map(move))
    moved = owed.value.moved
  } catch {
    for (const unitId of owed.value.moved) {
      try {
        await handOff(account, game, move(unitId))
        moved.push(unitId)
      } catch {
        // Gone from the Training Bay, or refused: it stays where it is.
      }
    }
  }
  await room.act(actor, 'returned', { moved })
}
