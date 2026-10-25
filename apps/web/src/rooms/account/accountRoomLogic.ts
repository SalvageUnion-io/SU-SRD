import type { ApplyOp } from '../ops'
import type { RoomSql } from '../sql'
import { AccountShelf } from './shelf'
import { AccountTransit } from './transit'

/**
 * One player's room, as plain logic over its SQL: what the `AccountRoom`
 * Durable Object serves (`../../worker/rooms.ts`). The Shelf is the
 * player's units and what they write; transit is what crosses into a Game
 * and back, and the cutover's import.
 */
export class AccountRoomLogic {
  readonly shelf: AccountShelf
  readonly transit: AccountTransit

  constructor(sql: RoomSql, deps: { applyOp: ApplyOp; newId?: () => string }) {
    this.shelf = new AccountShelf(sql, {
      applyOp: deps.applyOp,
      newId: deps.newId ?? (() => crypto.randomUUID()),
    })
    this.transit = new AccountTransit(this.shelf)
  }
}
