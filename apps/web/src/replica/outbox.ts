/**
 * Where a write leaves the client: every send to the server of record, each
 * awaited by the replica before it holds the change, so a write the server
 * refused did not happen here either (the replica).
 *
 * Today the sends are Convex mutations; from the cutover they are `ops`
 * messages on the room socket (`rooms/protocol.ts`).
 *
 * Offline, an op on the player's own pilot, mech or NPC waits here, kept on
 * the device beside the rows (`persist.ts`), and goes up as a replay
 * (`ops.replay`) when the status is `live` again (ADR-063 decision 9). Every
 * other send off `live` is a no-op: the replica has already refused the write.
 */

import type { FunctionArgs } from 'convex/server'
import { TABLE_OF_KIND } from 'game-domain/entityKinds'
import type { OpInput } from 'game-domain/ops/applyOp'
import { isEmptyOp } from 'game-domain/ops/applyOp'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { convexClient } from '../lib/connection/convexClient'
import { captureException } from '../lib/observability'
import { keepOutbox, readOutbox } from './persist'
import { row } from './replica'
import { roomCall } from './roomCalls'
import { noteRoomChange } from './roomChanges'
import { ROOM_FEED, RoomDeclined, roomOf, roomOrStandIn } from './roomSocket'
import { mayQueue, WritesBlockedOffline, writable } from './sync'

/** What the server answered for a unit it wrote: its new version and `headSeq`. */
export type Applied = { version: number; headSeq: number }

/**
 * Create or delete one entity in the room it lives in, and **fail if it does
 * not land**: its Game's room, or the player's account room for the Shelf.
 * A change to one is an op (`sendOp`).
 *
 * The room is the server of record, and the replica cannot legitimately be
 * ahead of it: a write the room refused **did not happen**, so the store
 * awaits this before touching its rows and lets the refusal throw.
 *
 * Returns immediately off `live`; the store has already refused any other
 * write (`requireWritable`).
 */
export async function sendRow(
  type: EntityRef['type'] | 'softLink',
  op:
    | { kind: 'upsert'; appId: string; gameId: string | null; body: unknown }
    | { kind: 'delete'; appId: string; gameId: string | null }
): Promise<Applied | undefined> {
  if (!writable()) return
  // Links are addressed by their endpoints rather than by an id, so they take
  // a different call shape — see `sendLink`.
  if (type === 'softLink') return
  const room = roomFor(op.gameId)
  if (op.kind === 'delete') {
    await room.act('removeUnit', { unitId: op.appId })
    return
  }
  await room.act('createUnit', { id: op.appId, kind: type, body: op.body })
  // A room makes a unit at seq 0, so the next op can be made against it
  // before the snapshot arrives.
  return { version: 0, headSeq: 0 }
}

/** The open room a unit in `gameId` is written through; none open, the write fails as offline. */
function roomFor(gameId: string | null) {
  const room = roomOrStandIn(gameId)
  if (room === null) throw new WritesBlockedOffline()
  return room
}

/** A unit kind: what an op changes. */
type UnitKind = EntityRef['type']

/**
 * Send one op to the server of record (`ops.apply`, ADR-063), and **fail if it
 * does not land**; the replica awaits this before it holds the change. An
 * op that moves its unit hands it to the new room first (`entities.move`).
 * The answer's `headSeq` is what the unit's next op is made against.
 */
export async function sendOp(
  unit: UnitKind,
  gameId: string | null,
  op: OpInput,
  move?: string | null
): Promise<Applied | undefined> {
  if (!writable()) {
    if (queues(unit, op.patch) && !isEmptyOp(op)) await queue({ unit, gameId, op })
    return
  }
  // Fed by the rooms (`RoomFeed`), an op on a unit in an open room goes there; its
  // new headSeq comes back as the room's `applied`. A move is a handoff
  // between rooms (`entities.move`), then the rest of the op in its new one.
  if (move !== undefined) {
    await roomCall('entities.move', { kind: unit, appId: op.unitId, gameId: move })
    noteRoomChange()
    if (isEmptyOp(op)) return
    const target = roomOf(move)
    if (target === null) throw new WritesBlockedOffline()
    await target.submit([op])
    return
  }
  const room = roomOf(gameId)
  if (room !== null) {
    if (!isEmptyOp(op)) await room.submit([op])
    return
  }
  if (isEmptyOp(op)) return
  const applied = await convexClient.mutation(api.ops.apply, {
    unit,
    gameId: gameId as Id<'games'> | null,
    op,
  })
  if (applied === null) return
  return { version: applied.updatedAt, headSeq: applied.headSeq }
}

// ── The outbox: own units' ops made offline ──────────────────────────────

/** An op waiting to go, with where its author held the unit. */
type Waiting = { unit: UnitKind; gameId: string | null; op: OpInput }

/**
 * Whether an edit to `unit` waits in the outbox now rather than being
 * refused: offline, on the player's own pilot, mech or NPC, and not a move (a
 * container is Game-wide, as a crawler is).
 */
export function queues(unit: EntityRef['type'] | 'softLink', patch: object): boolean {
  return mayQueue() && unit !== 'crawler' && unit !== 'softLink' && !('gameId' in patch)
}

let waiting: Promise<Waiting[]> | null = null

/** The ops waiting, oldest first, read from the device on first use. */
function waitingOps(): Promise<Waiting[]> {
  waiting ??= readOutbox<Waiting>()
  return waiting
}

/**
 * Keep one op until the connection returns. A unit holds at most one: a later
 * op folds into the one waiting, which keeps its `baseSeq`, so a second edit
 * offline is not refused on reconnect for a field the first one changed.
 */
async function queue(write: Waiting): Promise<void> {
  const ops = await waitingOps()
  const same = ops.find((w) => w.unit === write.unit && w.op.unitId === write.op.unitId)
  if (same === undefined) ops.push(write)
  else same.op = foldOps(same.op, write.op)
  await keepOutbox(ops)
}

/** `a` then `b` as one op: `b`'s fields win, and its provenance. */
function foldOps(a: OpInput, b: OpInput): OpInput {
  const patch: Record<string, unknown> = { ...a.patch, ...b.patch }
  const unset = new Set((a.unset ?? []).filter((field) => !(field in b.patch)))
  for (const field of b.unset ?? []) {
    unset.add(field)
    delete patch[field]
  }
  const { unset: _was, ...rest } = a
  return {
    ...rest,
    at: b.at,
    kind: b.kind,
    source: b.source,
    patch,
    ...(unset.size === 0 ? {} : { unset: [...unset] }),
  }
}

let flushing: Promise<string[]> | null = null

/**
 * Send what waits, oldest first, one replay at a time (`ops.replay`); answers
 * why each declined op was refused. A send that fails outright (the
 * connection went again) stops, keeping the rest for the next time.
 */
export function flushOutbox(): Promise<string[]> {
  flushing ??= (async () => {
    const declined: string[] = []
    const ops = await waitingOps()
    try {
      while (ops.length > 0 && writable()) {
        const { unit, gameId, op } = ops[0] as Waiting
        const room = roomOf(gameId)
        if (room !== null) {
          await room.submit([op]).catch((err: unknown) => {
            if (!(err instanceof RoomDeclined)) throw err
            declined.push(err.message)
          })
        } else {
          const answer = await convexClient.mutation(api.ops.replay, {
            unit,
            gameId: gameId as Id<'games'> | null,
            op,
          })
          if (answer !== null && 'declined' in answer) declined.push(answer.declined)
        }
        ops.shift()
        await keepOutbox(ops)
      }
    } catch {
      // Gone again: what is left waits for the next reconnect.
    } finally {
      flushing = null
    }
    return declined
  })()
  return flushing
}

/** The session ended: what waited is nobody's now (the device's copy goes with the rows). */
export function forgetOutbox(): void {
  waiting = null
  flushing = null
}

/**
 * Send a batch of Change Log rows to the server of record, which is the only
 * copy of the log there is (`changeLog.forEntity` is what the drawer reads).
 *
 * Never throws, and its callers do not await it: the log is provenance ABOUT a
 * write that has already happened and been committed, and failing the user's
 * edit because its audit row did not land would trade a real write for a
 * record of one. A failure is reported here, once, under one fingerprint —
 * not by each caller, which filed one fault as an issue per call site.
 *
 * A side that is `undefined` (a field set for the first time, or cleared) is
 * dropped by the Convex client on the wire; `appendChangeLog` stores it as
 * `null`.
 */
export async function sendChangeLog(
  entries: readonly {
    gameId: string | null
    entityType: 'pilot' | 'mech' | 'crawler' | 'npc' | 'softLink' | 'game'
    entityId: string
    ts: number
    kind: 'transaction' | 'override' | 'manual'
    field: string
    before: unknown
    after: unknown
    source: string
  }[]
): Promise<void> {
  if (!writable()) return
  if (entries.length === 0) return

  try {
    if (ROOM_FEED) return await sendRoomChangeLog(entries)
    await convexClient.mutation(api.changeLog.appendChangeLog, {
      entries: entries.map((e) => ({
        ...e,
        gameId: e.gameId === null ? null : (e.gameId as Id<'games'>),
      })),
    })
  } catch (err) {
    captureException(err, undefined, { fingerprint: ['convex', 'changeLog:appendChangeLog'] })
  }
}

/**
 * On the rooms, a unit's history is its ops (`rooms/ops.ts`'s `entityLog`):
 * only a Game's own rows (its rolls) are written, each to its Game's room.
 */
async function sendRoomChangeLog(entries: Parameters<typeof sendChangeLog>[0]): Promise<void> {
  const byGame = new Map<string, typeof entries>()
  for (const e of entries) {
    if (e.gameId === null || e.entityType !== 'game') continue
    byGame.set(e.gameId, [...(byGame.get(e.gameId) ?? []), e])
  }
  for (const [gameId, rows] of byGame) {
    await roomOf(gameId)?.act('changeLog.appendChangeLog', {
      entries: rows.map(({ entityType, field, after, source, ts }) => ({
        entityType,
        field,
        after,
        source,
        ts,
      })),
    })
  }
}

/**
 * A Shelf record's write, through the account room (`shelf.upsert<Record>` /
 * `shelf.remove<Record>`, Convex's names); refused while its socket is not open.
 */
async function shelfAct(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string },
  record: 'MechPattern' | 'EncounterNpc' | 'Encounter',
  idArg: string
): Promise<void> {
  const room = roomOrStandIn(null)
  if (room === null) throw new WritesBlockedOffline()
  await (op.kind === 'delete'
    ? room.act(`shelf.remove${record}`, { [idArg]: op.id })
    : room.act(`shelf.upsert${record}`, { body: op.record }))
}

/**
 * Commit one saved-pattern write.
 *
 * Addressed by the id inside the body rather than by an `appId` column, because
 * `mechPatterns` has none and needs none — a pattern's own id already is its app
 * id, which makes the upsert idempotent.
 *
 * Same early return as every other commit here: off the server of record this
 * is a no-op rather than an error.
 */
export async function sendPattern(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
): Promise<void> {
  if (!writable()) return
  await shelfAct(op, 'MechPattern', 'patternId')
}

/**
 * Commit one shelf-NPC write.
 *
 * Shelf only. A tray inside a Game belongs to the table rather than to a member
 * and is reached through `mediator.*` by the Mediator's role; this store holds
 * the personal tray.
 */
export async function sendTrayNpc(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
): Promise<void> {
  if (!writable()) return
  await shelfAct(op, 'EncounterNpc', 'npcId')
}

/**
 * Commit one encounter write (ADR-059). Shelf only and always the owner's,
 * like a pattern; a Game runs a copy through `mediator.runEncounter`.
 */
export async function sendEncounter(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
): Promise<void> {
  if (!writable()) return
  await shelfAct(op, 'Encounter', 'encounterId')
}

/**
 * Write one soft link, and fail if it does not land.
 *
 * Addressed by its endpoints because a room keys a link by its type, ends and
 * slot, and needs no id — `from.id`/`to.id` already are app ids. That also makes it
 * naturally idempotent, so a repeated write is a no-op rather than a duplicate
 * wire.
 */
export async function sendLink(kind: 'upsert' | 'delete', link: SoftLink | null): Promise<void> {
  if (!writable()) return
  if (link === null) return
  // A link without both endpoints has nothing to address, and half a link
  // fails validation server-side for no benefit.
  if (link.from?.id === undefined || link.to?.id === undefined) return

  const args = {
    from: link.from,
    to: link.to,
    type: link.type,
    ...(link.slot === undefined ? {} : { slot: link.slot }),
  }
  // The room holding its from end wires it (a link never crosses
  // containers); a unit with no copy here is on the Shelf.
  const room = roomFor(gameOfUnit(link.from))
  await room.act(kind === 'upsert' ? 'drawLink' : 'removeLink', { link: args })
}

/** The Game a unit is in, as the replica holds it; null on the Shelf, or not held here. */
function gameOfUnit(ref: { type: EntityRef['type']; id: string }): string | null {
  const held = row(ref.type, ref.id) as { gameId?: string | null } | null
  return held?.gameId ?? null
}

/** One op a transfer applies; a crawler's may move it first (`move`, its container). */
export type TransferWrite = {
  unit: UnitKind
  gameId: string | null
  op: OpInput
  move?: string | null
}

/**
 * One record a transfer removes. A link is named by its endpoints, so it is
 * read before the local delete leaves nothing to name it by.
 */
export type TransferRemoval =
  | { type: EntityRef['type']; id: string }
  | { type: 'softLink'; link: SoftLink | null }

type TransferArgs = FunctionArgs<typeof api.ops.transfer>

/** The `ops.transfer` args: each op as `ops.apply` takes it, each link by its endpoints. */
export function transferArgs(
  writes: readonly TransferWrite[],
  removals: readonly TransferRemoval[]
): TransferArgs {
  return {
    ops: writes.map(({ unit, gameId, op, move }) => ({
      unit,
      gameId: gameId as Id<'games'> | null,
      op,
      ...(move === undefined ? {} : { move: move as Id<'games'> | null }),
    })),
    deletes: removals.flatMap((removal): TransferArgs['deletes'] => {
      if (removal.type !== 'softLink') {
        return [{ table: TABLE_OF_KIND[removal.type], appId: removal.id }]
      }
      const { link } = removal
      // Half a link has nothing to address — see `sendLink`.
      if (link?.from?.id === undefined || link.to?.id === undefined) return []
      return [
        {
          table: 'softLinks' as const,
          from: link.from,
          to: link.to,
          type: link.type,
          ...(link.slot === undefined ? {} : { slot: link.slot }),
        },
      ]
    }),
  }
}

/**
 * Commit a cross-entity transfer (`units.transfer`) as ONE mutation,
 * and fail if it does not land.
 *
 * `ops.transfer` is a single Convex transaction, so the server holds either
 * every op and delete of a stow, a load or a scrap hand-off, or none of them:
 * a refusal on any record leaves every row as it was.
 */
export async function sendTransfer(
  writes: readonly TransferWrite[],
  removals: readonly TransferRemoval[]
): Promise<ReadonlyMap<string, Applied>> {
  if (!writable()) return new Map()
  if (ROOM_FEED) {
    await sendRoomTransfer(writes, removals)
    return new Map()
  }
  const { applied } = await convexClient.mutation(api.ops.transfer, transferArgs(writes, removals))
  return new Map(
    applied.map(({ unitId, updatedAt, headSeq }) => [unitId, { version: updatedAt, headSeq }])
  )
}

/**
 * On the rooms, a transfer is one batch to the room its units share, all or
 * none as `ops.transfer` was; each unit's new head comes back as the room's
 * `applied`. A room cannot hold half of one, so a transfer between units in
 * two rooms, or one that moves or deletes a unit, is refused before anything
 * is sent.
 */
async function sendRoomTransfer(
  writes: readonly TransferWrite[],
  removals: readonly TransferRemoval[]
): Promise<void> {
  const gameId = writes[0]?.gameId ?? null
  const together = writes.every((w) => w.gameId === gameId && w.move === undefined)
  if (!together || removals.length > 0) {
    throw new RoomDeclined('Both sides of a transfer must be at the same table')
  }
  const room = roomOf(gameId)
  if (room === null) throw new WritesBlockedOffline()
  await room.submit(writes.map((w) => w.op).filter((op) => !isEmptyOp(op)))
}
