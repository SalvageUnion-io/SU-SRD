/**
 * Taking an unused pre-generated pilot off a Game's roster, and putting it
 * back (LG4-20, ADR-067 §3): `GameRoom.shelve` and `unshelve`, in their own
 * module so `rooms.ts` keeps its room. Nothing is deleted: the units move to
 * the Organiser's Training Bay by the handoff every move makes.
 */
import type { GameActAnswer } from '../rooms/game/acts'
import type { GameRoomLogic } from '../rooms/game/gameRoomLogic'
import { handOffTogether } from '../rooms/handoff'
import { answerOrRefuse } from '../rooms/refusal'
import { accountHome } from './roomStubs'

/**
 * The pilot, and the mech it came with, leave for the Organiser's Training
 * Bay as one departure, so the pair arrives still assigned. Answers the ids
 * that left, for the Undo; `told` runs once they have.
 */
export async function shelved(
  logic: GameRoomLogic,
  actor: string,
  pilotId: string,
  told: () => void
): Promise<GameActAnswer<string[]>> {
  const at = Date.now()
  const going = answerOrRefuse(() => logic.roster.shelving(actor, pilotId, at))
  if (!going.ok) return going
  const to = { kind: 'account', userId: actor } as const
  await handOffTogether(
    logic.transit,
    accountHome(actor),
    going.value.map((unitId) => ({ leaseId: crypto.randomUUID(), unitId, actor, to, at }))
  )
  told()
  return going
}

/** Undo of `shelved`: the units come back from the Organiser's Training Bay, the Game's own again. */
export async function unshelved(
  logic: GameRoomLogic,
  gameId: string,
  actor: string,
  unitIds: readonly string[],
  told: () => void
): Promise<GameActAnswer<null>> {
  const at = Date.now()
  const allowed = answerOrRefuse(() => {
    logic.roster.unshelving(actor, unitIds)
    return null
  })
  if (!allowed.ok) return allowed
  const to = { kind: 'game', gameId } as const
  await handOffTogether(
    accountHome(actor),
    logic.transit,
    unitIds.map((unitId) => ({ leaseId: crypto.randomUUID(), unitId, actor, to, at }))
  )
  const back = answerOrRefuse(() => {
    logic.roster.reshelved(actor, unitIds, at)
    return null
  })
  told()
  return back
}
