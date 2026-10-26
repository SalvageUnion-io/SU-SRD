/**
 * An account room's Shelf acts (`SHELF_ACTS`): its records and who may read
 * them, run for the room's player (`./rooms.ts`). A refusal is the answer;
 * anything else thrown is a defect, the room's to report.
 */

import type { AccountRoomLogic } from '../rooms/account/accountRoomLogic'
import type { GameActAnswer } from '../rooms/game/acts'
import type { ACCOUNT_SOCKET_ACTS, socketAct } from '../rooms/game/socketActs'
import { SHELF_ACTS } from '../rooms/game/socketActs'
import { RoomRefusal } from '../rooms/refusal'
import { memberGameName } from './shared/crewPatterns'
import type { SharedDb } from './shared/db'

type AskedAct<A extends Parameters<typeof socketAct>[1]> = Exclude<
  ReturnType<typeof socketAct<A>>,
  { refusal: string }
>
type ShelfAct = AskedAct<typeof SHELF_ACTS>

/** Whether an account act is one of its Shelf's (`SHELF_ACTS`), answered here. */
export function isShelfAct(act: AskedAct<typeof ACCOUNT_SOCKET_ACTS>): act is ShelfAct {
  return Object.hasOwn(SHELF_ACTS, act.name)
}

/**
 * One write to the player's Shelf. Sharing a pattern with a Game asks the
 * shared database which Games they are in, the one read that leaves the room.
 */
async function shelfAct(
  logic: AccountRoomLogic,
  db: SharedDb | undefined,
  member: string,
  act: ShelfAct
): Promise<GameActAnswer<unknown>> {
  const at = Date.now()
  const { sharing } = logic
  try {
    switch (act.name) {
      case 'shelf.upsertMechPattern':
        return done(sharing.putRecord(member, 'patterns', act.args.body, at))
      case 'shelf.removeMechPattern':
        return done(sharing.removeRecord(member, 'patterns', act.args.patternId))
      case 'shelf.upsertEncounterNpc':
        return done(sharing.putRecord(member, 'npcTray', act.args.body, at))
      case 'shelf.removeEncounterNpc':
        return done(sharing.removeRecord(member, 'npcTray', act.args.npcId))
      case 'shelf.upsertEncounter':
        return done(sharing.putRecord(member, 'encounters', act.args.body, at))
      case 'shelf.removeEncounter':
        return done(sharing.removeRecord(member, 'encounters', act.args.encounterId))
      case 'shelf.setPatternVisibility': {
        const { patternId, visibility, gameId } = act.args
        const game = visibility === 'game' ? await gameOf(db, member, gameId) : null
        return done(sharing.setPatternVisibility(member, patternId, visibility, game, at))
      }
      case 'homebrew.setShared':
        return done(sharing.setHomebrew(member, act.args.patternId, act.args.shared, at))
      case 'publicSheet.setPublic': {
        const { kind, appId, isPublic } = act.args
        return done({ isPublic: sharing.setPublic(member, kind, appId, isPublic) })
      }
    }
  } catch (error) {
    if (error instanceof RoomRefusal) return { ok: false, refusal: error.message }
    throw error
  }
}

function done(value: unknown): GameActAnswer<unknown> {
  return { ok: true, value: value ?? null }
}

/** A Game the player is in, with its name, or a refusal. */
async function gameOf(db: SharedDb | undefined, member: string, gameId: string | undefined) {
  if (gameId === undefined) throw new RoomRefusal('Choose which Game to share it with')
  const name = db === undefined ? null : await memberGameName(db, gameId, member)
  if (name === null) throw new RoomRefusal('You are not in that Game')
  return { id: gameId, name }
}

/** Run one Shelf act for the room's socket: `answered` with its answer, or `broken` on a defect. */
export function runShelfAct(
  logic: AccountRoomLogic,
  db: SharedDb | undefined,
  member: string,
  act: ShelfAct,
  answered: (answer: GameActAnswer<unknown>) => void,
  broken: () => void
): void {
  shelfAct(logic, db, member, act).then(answered, (error: unknown) => {
    console.error('a Shelf act failed', act.name, error)
    broken()
  })
}
