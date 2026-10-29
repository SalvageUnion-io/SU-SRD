/**
 * How the Worker and the rooms reach a room: the namespaces `wrangler.jsonc`
 * declares, and the stubs callers hold.
 */

import { exports } from 'cloudflare:workers'
import type { DurableObjectNamespace } from '@cloudflare/workers-types'
import type { GameActAnswer, GameActArgs, GameActName, GameActResult } from '../rooms/game/acts'
import type { HomeAddress, UnitHome } from '../rooms/handoff'
import type { AccountRoom, GameRoom } from './rooms'

/** What the Game room asks of a player's account room: the handoff, and at a Game's end the Opposition tray and its list of Games. */
type AccountHome = UnitHome & {
  fileTray(leaseId: string, npcs: Record<string, unknown>[], at: number): Promise<void>
  countBuild(patternId: string, builder: string): Promise<boolean>
  leftGame(gameId: string): Promise<void>
}

/** The room namespaces, as `wrangler.jsonc` declares them. */
export function rooms() {
  return exports as unknown as {
    AccountRoom: DurableObjectNamespace<AccountRoom>
    GameRoom: DurableObjectNamespace<GameRoom>
  }
}

/**
 * A Game room's stub as its callers use it. workerd's own stub type drops a
 * result holding `unknown` (a unit's body) to `never`; every value here is
 * plain JSON, so each method answers its own result.
 */
export type GameRoomStub = {
  [K in 'unitsFor' | 'unit' | 'disband' | 'forget' | 'republish']: (
    ...args: Parameters<GameRoom[K]>
  ) => Promise<Awaited<ReturnType<GameRoom[K]>>>
} & {
  act<N extends GameActName>(
    actor: string,
    name: N,
    args: GameActArgs<N>
  ): Promise<GameActAnswer<GameActResult<N>>>
} & {
  [K in keyof UnitHome]: (
    ...args: Parameters<UnitHome[K]>
  ) => Promise<Awaited<ReturnType<UnitHome[K]>>>
}

/** The Game room named `gameId`. */
export function gameRoom(gameId: string): GameRoomStub {
  return rooms().GameRoom.getByName(gameId) as unknown as GameRoomStub
}

/** The room a unit lives in, as the other side of a handoff. */
export function homeOf(address: HomeAddress): UnitHome {
  return address.kind === 'game' ? gameRoom(address.gameId) : accountHome(address.userId)
}

/** A player's account room, by Discord id. */
export function accountHome(userId: string): AccountHome {
  return rooms().AccountRoom.getByName(userId) as unknown as AccountHome
}
