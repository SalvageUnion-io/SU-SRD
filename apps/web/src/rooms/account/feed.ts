import { roomLinks, roomUnit } from '../game/feed'
import type { ServerMessage } from '../protocol'
import type { AccountRoomLogic } from './accountRoomLogic'
import { SHELF_RECORDS } from './shelf'

/**
 * What an account room tells its player's sockets (`../protocol.ts`): the
 * whole Shelf (with the solo table: its salvage area, as a Game's
 * `salvageArea` record, and each Shelf pilot's solo seat) on connect and
 * after a unit, record or seat changes, else one `applied` per op (`appliedMessages`, shared with the Game room). Anyone
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
  const area = room.soloArea.here(actor)
  const salvageArea =
    area === null
      ? []
      : [{ appId: 'salvageArea', body: { ...area }, updatedAt: room.soloArea.updatedAt() }]
  return {
    type: 'snapshot',
    units: shelf.list(actor).map((unit) => roomUnit(unit, null)),
    records: {
      ...records,
      salvageArea,
      seats: room.solo.soloSeats(actor).map((seat) => ({
        appId: seat.pilotId,
        body: { ...seat },
        updatedAt: seat.updatedAt ?? 0,
      })),
    },
    links: roomLinks(shelf.store),
  }
}
