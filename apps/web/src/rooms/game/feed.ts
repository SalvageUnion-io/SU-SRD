import type { OpInput } from '../ops'
import type { RoomOp, RoomUnit, ServerMessage } from '../protocol'
import { ClientMessageSchema } from '../protocol'
import type { GameRoomLogic } from './gameRoomLogic'
import type { GameStore, StoredOp, UnitRow } from './store'
import type { SubmitResult } from './units'

/**
 * What a Game room tells a member's socket (`../protocol.ts`): the whole
 * Game on connect and after any act that changes more than one unit's body,
 * else one `applied` per op. Members see every unit and link; only a
 * Mediator sees the Opposition.
 */

export function gameSnapshot(room: GameRoomLogic, actor: string, gameId: string): ServerMessage {
  if (room.store.member(actor) === null)
    return { type: 'snapshot', units: [], records: {}, links: [] }
  return {
    type: 'snapshot',
    units: room.store.units().map((unit) => roomUnit(unit, gameId)),
    records: { opposition: room.opposition.trayRecords(actor), ...tableRecords(room, actor) },
    links: roomLinks(room.store),
  }
}

/**
 * What the table plays under, as each member reads it: one record each for the
 * Scene, the area, the ledger and the Stop Sign, and one per boundary. Who
 * added a boundary or showed the Stop Sign stays in the room (`safety.ts`).
 */
function tableRecords(room: GameRoomLogic, actor: string) {
  const area = room.scene.salvageArea(actor)
  const ledger = room.ledger.ledger(actor)
  const safety = room.safety.stopSign(actor)
  const one = (appId: string, body: object | null, updatedAt: number) =>
    body === null ? [] : [{ appId, body: { ...body }, updatedAt }]
  return {
    scene: one('scene', room.scene.scene(actor), room.scene.updatedAt('scene')),
    salvageArea: one('salvageArea', area, room.scene.updatedAt('salvage_area')),
    ledger: one('ledger', ledger, room.ledger.updatedAt()),
    boundaries: room.safety
      .boundaries(actor)
      .map(({ id, addedAt, ...body }) => ({ appId: id, body, updatedAt: addedAt })),
    safety: one('safety', safety, room.safety.updatedAt()),
  }
}

/**
 * One `applied` per op in `opIds` that is applied, with its unit at its new
 * head; `gameId` is null on a Shelf. The account room's feed shares it.
 */
export function appliedMessages(
  store: GameStore,
  opIds: readonly string[],
  gameId: string | null
): ServerMessage[] {
  return opIds.flatMap((id) => {
    const op = store.op(id)
    const unit = op === null ? null : store.unit(op.unitId)
    if (op === null || unit === null || op.state !== 'applied') return []
    return [{ type: 'applied', op: roomOp(op), unit: roomUnit(unit, gameId) }]
  })
}

/** Every link in `store` with its stable key as `id`, as the protocol carries them. */
export function roomLinks(store: GameStore) {
  return store.stampedLinks().map(({ key, createdAt, ...link }) => ({
    ...link,
    id: key,
    createdAt: new Date(createdAt).toISOString(),
  }))
}

export function roomUnit(unit: UnitRow, gameId: string | null): RoomUnit {
  return {
    kind: unit.kind as RoomUnit['kind'],
    appId: unit.id,
    gameId,
    owner: unit.ownerId,
    publicRead: unit.publicRead,
    body: unit.body,
    headSeq: unit.headSeq,
    fieldSeqs: unit.fieldSeqs,
    updatedAt: unit.updatedAt,
  }
}

function roomOp({ supersededBy: _, ...op }: StoredOp): RoomOp {
  return op
}

/** A client's `ops` batch, or null when the message is not one. */
export function readOpsBatch(message: string | ArrayBuffer): OpInput[] | null {
  try {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    const parsed = ClientMessageSchema.safeParse(JSON.parse(text))
    return parsed.success && parsed.data.type === 'ops' ? parsed.data.ops : null
  } catch {
    return null
  }
}

/** What the sender hears when its message is not a batch. */
export const UNREADABLE: ServerMessage = {
  type: 'declined',
  opIds: [],
  reason: 'Not a message this room reads',
}

/** What the sender of a batch hears: `ack`, or why it was declined. */
export function batchAnswer(opIds: string[], result: SubmitResult): ServerMessage {
  if (result.ok) return { type: 'ack', opIds }
  const reason =
    result.reason === 'conflict'
      ? `Changed elsewhere first: ${result.fields.join(', ')}`
      : result.message
  return refusedBatch(opIds, reason)
}

export function refusedBatch(opIds: string[], reason: string): ServerMessage {
  return { type: 'declined', opIds, reason }
}
