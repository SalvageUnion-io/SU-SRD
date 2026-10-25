import type { ApplyOp } from '../ops'
import type { RoomSql } from '../sql'
import { GameOpposition } from './opposition'
import { GamePlay } from './play'
import { GameProposals } from './proposals'
import { GameRoster, randomInviteCode } from './roster'
import { GameStore } from './store'
import { GameTransit } from './transit'
import { GameUnits } from './units'

/**
 * One Game's room, as plain logic over its SQL: what the `GameRoom`
 * Durable Object serves (`../../worker/rooms.ts`). Each part keeps the rules
 * of the Convex module it replaces.
 */
export class GameRoomLogic {
  readonly roster: GameRoster
  readonly units: GameUnits
  readonly proposals: GameProposals
  readonly play: GamePlay
  readonly opposition: GameOpposition
  readonly transit: GameTransit

  constructor(
    sql: RoomSql,
    deps: { applyOp: ApplyOp; newId?: () => string; mintCode?: () => string }
  ) {
    const store = new GameStore(sql)
    const newId = deps.newId ?? (() => crypto.randomUUID())
    this.units = new GameUnits(store, deps.applyOp, newId)
    this.proposals = new GameProposals(store, this.units)
    this.roster = new GameRoster(store, this.units, deps.mintCode ?? randomInviteCode)
    this.play = new GamePlay(store, this.units, newId)
    this.opposition = new GameOpposition(store, newId)
    this.transit = new GameTransit(store, this.units, this.play)
  }
}
