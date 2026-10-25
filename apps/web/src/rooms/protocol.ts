/**
 * The room socket protocol (ADR-064): what an account room and a Game room
 * say to a client over `${ROOMS_PATH}/account/socket` and
 * `${ROOMS_PATH}/games/:gameId/socket`, and what a client says back.
 *
 * The client's replica (`src/replica/`) is the one reader: it holds
 * what the snapshot and deltas carry and nothing else. Every message is JSON,
 * discriminated by `type` (as the Game room's `presence` message is).
 *
 *  - On connect the room sends one `snapshot`: its whole state for this
 *    caller. Whatever a snapshot leaves out is gone, for this room.
 *  - Then deltas, in the order the room applied them: `applied` after each
 *    applied op (the op, for the outbox and the Change Log, and the unit at
 *    its new `headSeq`, so a client never refolds), `gone` when a unit leaves
 *    the room (deleted, or moved to another container), `record` and
 *    `recordGone` for the op-less bodies, `links` as the room's whole link
 *    set whenever it changes.
 *  - A client sends `ops`: one batch, applied all or none (a transfer is a
 *    batch), answered by `ack` or `declined` naming the batch's op ids.
 *    An op id is idempotent, so a replay after a reconnect is safe.
 *  - Or an `act`: one named write the room has to decide (spending the last
 *    Supply, passing an hour, showing the Stop Sign), answered by `answered`
 *    with its value or `refused` with why, naming the act's id. Its effect
 *    reaches every socket as `record` deltas, as any other write's does.
 *
 * Exports marked `@public` are the contract the client reads before the
 * rooms send them; each loses the mark when the room side lands.
 */

import { z } from 'salvageunion-reference/zod'

const Body = z.record(z.string(), z.unknown())

/** @public */
export const UNIT_KINDS = ['pilot', 'mech', 'crawler', 'npc'] as const

/** One op as ADR-063 defines it, as the room stores it once applied. @public */
export const RoomOpSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  seq: z.number().int().nullable(),
  baseSeq: z.number().int().nullable(),
  author: z.string().nullable(),
  at: z.number(),
  kind: z.enum(['transaction', 'override', 'manual']),
  source: z.string(),
  state: z.enum(['applied', 'proposed', 'declined', 'superseded']),
  patch: Body,
  unset: z.array(z.string()).optional(),
  before: Body.nullable(),
  reason: z.string().optional(),
})
export type RoomOp = z.infer<typeof RoomOpSchema>

/**
 * @public What a client sends: ADR-063's `OpInput` (game-domain `ops/applyOp`).
 * The author, `seq`, `state` and `before` are the room's to write.
 */
export const OpInputSchema = RoomOpSchema.pick({
  id: true,
  unitId: true,
  baseSeq: true,
  at: true,
  kind: true,
  source: true,
  patch: true,
  unset: true,
})

/** A pilot, mech, crawler or NPC as held: the bundle's `BundleUnit` without its op log. @public */
export const RoomUnitSchema = z.object({
  kind: z.enum(UNIT_KINDS),
  appId: z.string(),
  /** The Game it is in; null on the Shelf (ADR-030 §2). */
  gameId: z.string().nullable(),
  /** Discord id of its owner or assignee; null for an unassigned unit in a Game. */
  owner: z.string().nullable(),
  publicRead: z.boolean(),
  body: Body,
  headSeq: z.number().int(),
  fieldSeqs: z.record(z.string(), z.number().int()),
  updatedAt: z.number(),
})
export type RoomUnit = z.infer<typeof RoomUnitSchema>

/**
 * The op-less bodies a room holds, each addressed by the id in its body.
 * @public A Game room's table state, one record each unless named:
 *  - `scene`: `{ conditions, hours }`.
 *  - `salvageArea`: `{ name, techLevel, supply }`, none when unset; an
 *    account room keeps its player's solo table's.
 *  - `ledger`: `{ factions, jobs, incomeCollected }`.
 *  - `boundaries`: one record per boundary, `{ kind, text, mine, mayRemove }`.
 *  - `safety`: `{ stop: { shownAt, mine, mayLift } | null, mayManage, postToChannel }`.
 * Who added a boundary or showed the Stop Sign never reaches a socket: each
 * reader gets `mine` and what it may do, so these records are per reader.
 */
export const RECORD_TABLES = [
  'patterns',
  'encounters',
  'npcTray',
  'opposition',
  'scene',
  'salvageArea',
  'ledger',
  'boundaries',
  'safety',
] as const
/** @public */
export type RecordTable = (typeof RECORD_TABLES)[number]

/** `updatedAt` lets a reconnecting client tell a changed record from one it holds. */
const RoomRecordSchema = z.object({ appId: z.string(), body: Body, updatedAt: z.number() })

/**
 * A link as game-domain's `SoftLinkSchema` holds it. `id` is the room's stable
 * key for it (its type, ends and slot), `createdAt` an ISO time.
 */
const RoomLinkSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  type: z.string(),
  from: z.object({ type: z.string(), id: z.string() }),
  to: z.object({ type: z.string(), id: z.string() }),
  slot: z.unknown().optional(),
})

/** Room to client. @public */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot'),
    units: z.array(RoomUnitSchema),
    /** Every table the room keeps; a Game room's `opposition` reaches its Mediator only. */
    records: z.partialRecord(z.enum(RECORD_TABLES), z.array(RoomRecordSchema)),
    links: z.array(RoomLinkSchema),
  }),
  z.object({ type: z.literal('applied'), op: RoomOpSchema, unit: RoomUnitSchema }),
  z.object({ type: z.literal('gone'), kind: z.enum(UNIT_KINDS), appId: z.string() }),
  z.object({ type: z.literal('record'), table: z.enum(RECORD_TABLES), record: RoomRecordSchema }),
  z.object({ type: z.literal('recordGone'), table: z.enum(RECORD_TABLES), appId: z.string() }),
  z.object({ type: z.literal('links'), links: z.array(RoomLinkSchema) }),
  z.object({ type: z.literal('ack'), opIds: z.array(z.string()) }),
  z.object({ type: z.literal('declined'), opIds: z.array(z.string()), reason: z.string() }),
  z.object({ type: z.literal('answered'), id: z.string(), value: z.unknown().optional() }),
  z.object({ type: z.literal('refused'), id: z.string(), reason: z.string() }),
  z.object({ type: z.literal('presence'), here: z.array(z.string()) }),
])
export type ServerMessage = z.infer<typeof ServerMessageSchema>

/** Client to room. */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ops'), ops: z.array(OpInputSchema).min(1) }),
  /** `name` is one of the room's acts, named for its Convex function (`salvageAreas.spend`, `scenes.passHour`, …). */
  z.object({
    type: z.literal('act'),
    id: z.string(),
    name: z.string(),
    args: z.unknown().optional(),
  }),
])
/** @public */
export type ClientMessage = z.infer<typeof ClientMessageSchema>
