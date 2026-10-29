import type { ClientMessage, RoomOp, RoomUnit, ServerMessage } from '../protocol'
import { ClientMessageSchema } from '../protocol'
import { DEFECT_REFUSAL } from '../refusal'
import { crewVitals } from '../vitals'
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
    records: {
      opposition: room.opposition.trayRecords(actor),
      mediator: room.opposition.mediatorRecords(actor),
      ...tableRecords(room, actor),
      ...playRecords(room, actor),
    },
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
 * The table in play, as each member reads it: the roster, every pilot's
 * seat, the Downtime, the proposals waiting on them (and, for a Mediator,
 * every one sent), the newest rolls and alerts, and the crew's vitals.
 */
function playRecords(room: GameRoomLogic, actor: string) {
  const by = <T extends object>(rows: T[], appId: (row: T) => string, at: (row: T) => number) =>
    rows.map((row) => ({ appId: appId(row), body: { ...row }, updatedAt: at(row) }))
  const downtime = room.play.downtime(actor)
  return {
    members: by(
      room.roster.members(actor),
      (m) => m.userId,
      (m) => m.joinedAt
    ),
    seats: by(
      room.play.seats(actor),
      (s) => s.pilotId,
      (s) => s.updatedAt ?? 0
    ),
    downtime:
      downtime === null
        ? []
        : [{ appId: 'downtime', body: { ...downtime }, updatedAt: downtime.startedAt ?? 0 }],
    proposals: by(
      room.proposals.pending(actor),
      (p) => p._id,
      (p) => p.ts
    ),
    sentProposals: by(
      room.proposals.sent(actor),
      (p) => p._id,
      (p) => p.ts
    ),
    rolls: by(
      room.log.rolls(actor),
      (r) => r._id,
      (r) => r.ts
    ),
    alerts: by(
      room.log.alerts(actor),
      (a) => a._id,
      (a) => a.ts
    ),
    crew: [crewRecord(room)],
  }
}

/**
 * Every crewmate's vitals, the same for every member: after an op it is sent
 * on its own, since an op changes no other record. The reference data the
 * derivation reads is the room's to load first (`loadCrewReference`).
 */
export function crewRecord(room: GameRoomLogic) {
  return { appId: 'crew', body: { ...crewVitals(room.store) }, updatedAt: 0 }
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

/** What a client said (`ops` or `act`), or null when it is not a message a room reads. */
export function readClientMessage(message: string | ArrayBuffer): ClientMessage | null {
  try {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    const parsed = ClientMessageSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
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
  if (result.ok) return { type: 'ack', opIds, fresh: result.fresh }
  const reason =
    result.reason === 'conflict'
      ? `Changed elsewhere first: ${result.fields.join(', ')}`
      : result.message
  return refusedBatch(opIds, reason)
}

export function refusedBatch(opIds: string[], reason: string): ServerMessage {
  return { type: 'declined', opIds, reason }
}

/** What the sender hears when the room failed on its message: refused, without the defect's words. */
export function defectAnswer(said: ClientMessage): ServerMessage {
  return said.type === 'act'
    ? { type: 'refused', id: said.id, reason: DEFECT_REFUSAL }
    : refusedBatch(
        said.ops.map((op) => op.id),
        DEFECT_REFUSAL
      )
}
