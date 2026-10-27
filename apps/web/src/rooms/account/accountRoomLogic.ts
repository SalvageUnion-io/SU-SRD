import type { ApplyOp } from '../ops'
import type { RoomSql } from '../sql'
import { AccountSharing } from './sharing'
import { AccountShelf } from './shelf'
import { AccountSoloArea } from './soloArea'
import { AccountSoloPlay } from './soloPlay'
import { AccountTransit } from './transit'

/**
 * One player's room, as plain logic over its SQL: what the `AccountRoom`
 * Durable Object serves (`../../worker/rooms.ts`). The Shelf is the
 * player's units and what they write; transit is what crosses into a Game
 * and back, and the cutover's import; the solo area is what their own table
 * is salvaging, and solo its seats and Downtime; sharing is the Shelf's
 * records and who may read them.
 */
export class AccountRoomLogic {
  readonly shelf: AccountShelf
  readonly transit: AccountTransit
  readonly soloArea: AccountSoloArea
  readonly solo: AccountSoloPlay
  readonly sharing: AccountSharing

  constructor(sql: RoomSql, deps: { applyOp: ApplyOp; newId?: () => string }) {
    this.shelf = new AccountShelf(sql, {
      applyOp: deps.applyOp,
      newId: deps.newId ?? (() => crypto.randomUUID()),
    })
    this.soloArea = new AccountSoloArea(this.shelf)
    this.solo = new AccountSoloPlay(this.shelf)
    this.transit = new AccountTransit(this.shelf, this.soloArea)
    this.sharing = new AccountSharing(this.shelf)
  }
}
