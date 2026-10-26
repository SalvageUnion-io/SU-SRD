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
import { ROOM_FEED, RoomDeclined, roomOf } from './roomSocket'
import { mayQueue, WritesBlockedOffline, writable } from './sync'

/** What the server answered for a unit it wrote: its new version and `headSeq`. */
export type Applied = { version: number; headSeq: number }

/**
 * Create or delete one entity on the server of record, and **fail if it does
 * not land**. A change to one is an op (`sendOp`).
 *
 * Convex is the server of record (ADR-034), and the replica cannot legitimately
 * be ahead of it: a write the server refused **did not happen**, so the store
 * awaits this before touching its rows and lets the refusal throw.
 *
 * Returns immediately unless the backend is `remote`; the store has already
 * refused any other write (`requireWritable`).
 */
export async function sendRow(
  type: EntityRef['type'] | 'softLink',
  op:
    | { kind: 'upsert'; appId: string; gameId: string | null; body: unknown }
    | { kind: 'delete'; appId: string; gameId: string | null }
): Promise<Applied | undefined> {
  if (!writable()) return

  if (type === 'softLink') {
    // Links are addressed by their endpoints rather than by an id, so they take
    // a different call shape — see `sendLink`.
    return
  }

  // Fed by the rooms, the unit's room makes it or deletes it; its next
  // snapshot carries the change, as an op's `applied` does.
  const room = roomOf(op.gameId)
  if (room !== null) {
    if (op.kind === 'delete') await room.act('removeUnit', { unitId: op.appId })
    else await room.act('createUnit', { id: op.appId, kind: type, body: op.body })
    return
  }

  if (type === 'crawler') {
    if (op.kind === 'delete') {
      await convexClient.mutation(api.entities.removeCrawlerByAppId, { appId: op.appId })
      return
    }
    await convexClient.mutation(api.entities.createCrawler, {
      gameId: op.gameId as Id<'games'> | null,
      appId: op.appId,
      body: op.body,
    })
    return
  }

  const table = TABLE_OF_KIND[type]
  if (op.kind === 'delete') {
    await convexClient.mutation(api.entities.removeByAppId, {
      table,
      appId: op.appId,
      gameId: op.gameId === null ? null : (op.gameId as Id<'games'>),
    })
    return
  }
  // A create: no version of the row is held yet.
  const { updatedAt } = await convexClient.mutation(api.entities.upsertByAppId, {
    table,
    appId: op.appId,
    gameId: op.gameId === null ? null : (op.gameId as Id<'games'>),
    body: op.body,
    expectedUpdatedAt: null,
  })
  return { version: updatedAt, headSeq: 0 }
}

/** A unit kind: what an op changes. */
type UnitKind = EntityRef['type']

/**
 * Send one op to the server of record (`ops.apply`, ADR-063), and **fail if it
 * does not land**; the replica awaits this before it holds the change. A
 * crawler's container is `moveCrawler`'s to write, so a crawler op that moves
 * one moves it first. The answer's `headSeq` is what the unit's next op is
 * made against.
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
  if (ROOM_FEED && move !== undefined) {
    await roomCall('entities.move', { kind: unit, appId: op.unitId, gameId: move })
    noteRoomChange()
    if (isEmptyOp(op)) return
    const target = roomOf(move)
    if (target === null) throw new WritesBlockedOffline()
    await target.submit([op])
    return
  }
  const room = move === undefined ? roomOf(gameId) : null
  if (room !== null) {
    if (!isEmptyOp(op)) await room.submit([op])
    return
  }
  if (unit === 'crawler' && move !== undefined) {
    await convexClient.mutation(api.entities.moveCrawler, {
      appId: op.unitId,
      gameId: move as Id<'games'> | null,
    })
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
 * A Shelf record's write, through the account room while its socket is open
 * (`shelf.upsert<Record>` / `shelf.remove<Record>`, Convex's names); false
 * when it is not, and the write goes to Convex.
 */
async function shelfAct(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string },
  record: 'MechPattern' | 'EncounterNpc' | 'Encounter',
  idArg: string
): Promise<boolean> {
  const room = roomOf(null)
  if (room === null) return false
  await (op.kind === 'delete'
    ? room.act(`shelf.remove${record}`, { [idArg]: op.id })
    : room.act(`shelf.upsert${record}`, { body: op.record }))
  return true
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
  if (await shelfAct(op, 'MechPattern', 'patternId')) return

  if (op.kind === 'delete') {
    await convexClient.mutation(api.shelf.removeMechPattern, { patternId: op.id })
    return
  }
  await convexClient.mutation(api.shelf.upsertMechPattern, { body: op.record })
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
  if (await shelfAct(op, 'EncounterNpc', 'npcId')) return

  if (op.kind === 'delete') {
    await convexClient.mutation(api.shelf.removeEncounterNpc, { npcId: op.id })
    return
  }
  await convexClient.mutation(api.shelf.upsertEncounterNpc, { body: op.record })
}

/**
 * Commit one encounter write (ADR-059). Shelf only and always the owner's,
 * like a pattern; a Game runs a copy through `mediator.runEncounter`.
 */
export async function sendEncounter(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string }
): Promise<void> {
  if (!writable()) return
  if (await shelfAct(op, 'Encounter', 'encounterId')) return

  if (op.kind === 'delete') {
    await convexClient.mutation(api.shelf.removeEncounter, { encounterId: op.id })
    return
  }
  await convexClient.mutation(api.shelf.upsertEncounter, { body: op.record })
}

/**
 * Write one soft link, and fail if it does not land.
 *
 * Addressed by its endpoints because the server has no `appId` column for links
 * and needs none — `from.id`/`to.id` already are app ids. That also makes it
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
  // Fed by the rooms, the room holding its from end wires it (a link never
  // crosses containers); a unit with no copy here is on the Shelf.
  const room = roomOf(gameOfUnit(link.from))
  if (room !== null) {
    await room.act(kind === 'upsert' ? 'drawLink' : 'removeLink', { link: args })
    return
  }
  if (kind === 'upsert') {
    await convexClient.mutation(api.entities.upsertSoftLink, args)
  } else {
    await convexClient.mutation(api.entities.removeSoftLink, args)
  }
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
