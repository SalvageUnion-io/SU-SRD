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
 *    An op id is idempotent, so a replay after a reconnect is safe, and
 *    the `ack` says which ids it applied `fresh`. A batch
 *    made offline is `replayed`, and a Game room takes it only on the
 *    sender's own units (ADR-063 decision 9).
 *  - Or an `act`: one named write the room has to decide (spending the last
 *    Supply, passing an hour, showing the Stop Sign), answered by `answered`
 *    with its value or `refused` with why, naming the act's id. Its effect
 *    reaches every socket as `record` deltas, as any other write's does.
 *  - A message the room fails on (a defect) is still answered, `declined` or
 *    `refused` with `DEFECT_REFUSAL`, never its message, so a write never
 *    waits on an answer that will not come.
 *  - A reader who is no longer in the room (its Game ended, or they left it
 *    for good) has their socket closed with `ROOM_GONE`, which the client
 *    does not reopen.
 *
 * Exports marked `@public` are the contract the client reads before the
 * rooms send them; each loses the mark when the room side lands.
 */

import { ENTITY_KINDS } from 'game-domain/entityKinds'
import { OP_STATES } from 'game-domain/ops/opState'
import { CHANGE_LOG_KINDS } from 'game-domain/schemas/changeLog'
import { z } from 'salvageunion-reference/zod'

const Body = z.record(z.string(), z.unknown())

/** One op as ADR-063 defines it, as the room stores it once applied. @public */
export const RoomOpSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  seq: z.number().int().nullable(),
  baseSeq: z.number().int().nullable(),
  author: z.string().nullable(),
  at: z.number(),
  kind: z.enum(CHANGE_LOG_KINDS),
  source: z.string(),
  state: z.enum(OP_STATES),
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

/** A pilot, mech, crawler or NPC as held, without its op log. @public */
export const RoomUnitSchema = z.object({
  kind: z.enum(ENTITY_KINDS),
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
 *  - `opposition`: one record per tray NPC, its body; the Mediator's only.
 *  - `mediator`: one record, `{ running }`, the encounter being run or null;
 *    served to the Mediator only, so a reader without it does not mediate.
 * Who added a boundary or showed the Stop Sign never reaches a socket: each
 * reader gets `mine` and what it may do, so these records are per reader.
 * @public And the table in play, each as its read answers:
 *  - `members`: one per member, by Discord id (`games.members`).
 *  - `seats`: one per pilot (`seats.forGame`; an account room's, each Shelf
 *    pilot's solo seat with its Downtime, `seats.solo`).
 *  - `downtime`: `downtime.state`, with each pilot's `doneSteps` by pilot id.
 *  - `proposals`: those waiting on this reader (`ops.pending`);
 *    `sentProposals`: every Mediator's, for a Mediator (`ops.sent`).
 *  - `rolls` and `alerts`: the newest of each (`changeLog.rolls`, `.alerts`).
 *  - `crew`: every crewmate's vitals (`crew.vitals`), one record for all.
 *  - `sharing`: an account room's, one record per saved pattern, by its id:
 *    `{ visibility, gameId, gameName, builtCount, homebrew }`.
 */
export const RECORD_TABLES = [
  'patterns',
  'encounters',
  'npcTray',
  'opposition',
  'mediator',
  'scene',
  'salvageArea',
  'ledger',
  'boundaries',
  'safety',
  'members',
  'seats',
  'downtime',
  'proposals',
  'sentProposals',
  'rolls',
  'alerts',
  'crew',
  'sharing',
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
  z.object({ type: z.literal('gone'), kind: z.enum(ENTITY_KINDS), appId: z.string() }),
  z.object({ type: z.literal('record'), table: z.enum(RECORD_TABLES), record: RoomRecordSchema }),
  z.object({ type: z.literal('recordGone'), table: z.enum(RECORD_TABLES), appId: z.string() }),
  z.object({ type: z.literal('links'), links: z.array(RoomLinkSchema) }),
  z.object({
    type: z.literal('ack'),
    opIds: z.array(z.string()),
    /** The op ids this batch applied; the others had landed before (a resend, a replay). */
    fresh: z.array(z.string()),
  }),
  z.object({ type: z.literal('declined'), opIds: z.array(z.string()), reason: z.string() }),
  z.object({ type: z.literal('answered'), id: z.string(), value: z.unknown().optional() }),
  z.object({ type: z.literal('refused'), id: z.string(), reason: z.string() }),
  z.object({ type: z.literal('presence'), here: z.array(z.string()) }),
])
export type ServerMessage = z.infer<typeof ServerMessageSchema>

/** The close code that ends a socket for good: its reader is no longer in the room. */
export const ROOM_GONE = 4410

/** Client to room. */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ops'),
    ops: z.array(OpInputSchema).min(1),
    /** Made offline and sent from the outbox: only the sender's own units. */
    replayed: z.literal(true).optional(),
  }),
  /** `name` is one of the room's acts, named as the client calls it (`salvageAreas.spend`, `scenes.passHour`, …). */
  z.object({
    type: z.literal('act'),
    id: z.string(),
    name: z.string(),
    args: z.unknown().optional(),
  }),
])
/** @public */
export type ClientMessage = z.infer<typeof ClientMessageSchema>
