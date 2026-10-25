import { roomLinks, roomUnit } from '../game/feed'
import type { ServerMessage } from '../protocol'
import type { AccountRoomLogic } from './accountRoomLogic'
import { SHELF_RECORDS } from './shelf'

/**
 * What an account room tells its player's sockets (`../protocol.ts`): the
 * whole Shelf on connect and after a unit or record arrives or leaves, else
 * one `applied` per op (`appliedMessages`, shared with the Game room). Anyone
 * but the room's player is told nothing.
 */
export function shelfSnapshot(room: AccountRoomLogic, actor: string): ServerMessage {
  const { shelf } = room
  if (shelf.owner() !== actor) return { type: 'snapshot', units: [], records: {}, links: [] }
  const records = Object.fromEntries(
    SHELF_RECORDS.map((table) => [
      table,
      shelf.store
        .rows('select app_id, body, updated_at from records where tbl = ? order by app_id', table)
        .map((row) => ({
          appId: String(row.app_id),
          body: JSON.parse(String(row.body)) as Record<string, unknown>,
          updatedAt: Number(row.updated_at),
        })),
    ])
  )
  return {
    type: 'snapshot',
    units: shelf.list(actor).map((unit) => roomUnit(unit, null)),
    records,
    links: roomLinks(shelf.store),
  }
}
