/**
 * Where a write leaves the client: every send to the server of record, each
 * awaited by the replica before it holds the change, so a write the server
 * refused did not happen here either (the replica). The sends are `ops`
 * batches and acts on the room's socket (`rooms/protocol.ts`).
 *
 * Offline, an op on the player's own pilot, mech or NPC waits here, kept on
 * the device beside the rows (`persist.ts`), and goes up to its room when the
 * status is `live` again (ADR-063 decision 9). Every other send off `live` is
 * a no-op: the replica has already refused the write.
 */

import type { OpInput } from 'game-domain/ops/applyOp'
import { isEmptyOp } from 'game-domain/ops/applyOp'
import type { EntityRef } from 'game-domain/schemas/entity'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { captureException } from '../lib/observability'
import { sharedCopy } from '../messages/components-shared'
import { keepOutbox, readOutbox } from './persist'
import { row } from './replica'
import { roomCall } from './roomCalls'
import { noteRoomChange } from './roomChanges'
import { gameGone, RoomDeclined, roomOrStandIn } from './roomSocket'
import { mayQueue, WritesBlockedOffline, writable } from './sync'

/** What the room answered for a unit it made: its version and `headSeq`. */
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
 * Send one op to its unit's room (ADR-063), and **fail if it does not land**;
 * the replica awaits this before it holds the change, and the unit's new
 * headSeq comes back as the room's `applied`. An op that moves its unit hands
 * it to the new room first (`entities.move`).
 */
export async function sendOp(
  unit: UnitKind,
  gameId: string | null,
  op: OpInput,
  move?: string | null
): Promise<void> {
  if (!writable()) {
    if (queues(unit, op.patch) && !isEmptyOp(op)) await queue({ unit, gameId, op })
    return
  }
  // A move is a handoff between rooms (`entities.move`), then the rest of the
  // op in its new one.
  if (move !== undefined) {
    await roomCall('entities.move', { kind: unit, appId: op.unitId, gameId: move })
    noteRoomChange()
  }
  if (isEmptyOp(op)) return
  await roomFor(move === undefined ? gameId : move).submit([op])
}

// ── The outbox: own units' ops made offline ──────────────────────────────

/** An op waiting to go, with where its author held the unit; `sent` once a flush has sent it. */
type Waiting = { unit: UnitKind; gameId: string | null; op: OpInput; sent?: true }

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
 * Keep one op until the connection returns. A unit holds at most one unsent:
 * a later op folds into it, keeping its `baseSeq`, so a second edit offline
 * is not refused on reconnect for a field the first one changed. One already
 * sent may have landed under its id, which the room would not apply twice,
 * so a later edit waits behind it as an op of its own.
 */
async function queue(write: Waiting): Promise<void> {
  const ops = await waitingOps()
  const same = ops.find(
    (w) => w.sent !== true && w.unit === write.unit && w.op.unitId === write.op.unitId
  )
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
 * Send what waits, oldest first, one op at a time to its room, as replayed
 * (the room takes it only on the player's own units); answers why each
 * declined op was refused. An op for a Game the player is no longer in (it
 * ended, or they left, while offline: `gameGone`) is dropped and told as
 * declined. One whose room is only not open yet keeps waiting without
 * holding up the others; a send that fails outright (the connection went
 * again) stops, keeping the rest for next time. A call while one is under
 * way waits for it and answers none, so each refusal is told once.
 */
export function flushOutbox(): Promise<string[]> {
  if (flushing !== null) return flushing.then(() => [])
  flushing = (async () => {
    const declined: string[] = []
    const ops = await waitingOps()
    try {
      for (const write of [...ops]) {
        if (!writable()) break
        if (gameGone(write.gameId)) {
          declined.push(sharedCopy('offlineGameGone'))
          ops.splice(ops.indexOf(write), 1)
          await keepOutbox(ops)
          continue
        }
        const room = roomOrStandIn(write.gameId)
        if (room === null) continue
        // From here it may land, so nothing folds into it (`queue`).
        write.sent = true
        await keepOutbox(ops)
        await room.submit([write.op], { replayed: true }).catch((err: unknown) => {
          if (!(err instanceof RoomDeclined)) throw err
          declined.push(err.message)
        })
        ops.splice(ops.indexOf(write), 1)
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
 * Send a batch of Change Log rows. A unit's history is its ops (`rooms/ops.ts`'s
 * `entityLog`), so only a Game's own rows (its rolls) are written, each to its
 * Game's room.
 *
 * Never throws, and its callers do not await it: the log is provenance ABOUT a
 * write that has already happened and been committed, and failing the user's
 * edit because its audit row did not land would trade a real write for a
 * record of one. A failure is reported here, once, under one fingerprint —
 * not by each caller, which filed one fault as an issue per call site.
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

  const byGame = new Map<string, typeof entries>()
  for (const e of entries) {
    if (e.gameId === null || e.entityType !== 'game') continue
    byGame.set(e.gameId, [...(byGame.get(e.gameId) ?? []), e])
  }
  try {
    for (const [gameId, rows] of byGame) {
      await roomOrStandIn(gameId)?.act('changeLog.appendChangeLog', {
        entries: rows.map(({ entityType, field, after, source, ts }) => ({
          entityType,
          field,
          after,
          source,
          ts,
        })),
      })
    }
  } catch (err) {
    captureException(err, undefined, { fingerprint: ['rooms', 'changeLog:appendChangeLog'] })
  }
}

/**
 * A Shelf record's write, through the account room (`shelf.upsert<Record>` /
 * `shelf.remove<Record>`); refused while its socket is not open.
 */
async function shelfAct(
  op: { kind: 'upsert'; record: { id: string } } | { kind: 'delete'; id: string },
  record: 'MechPattern' | 'EncounterNpc' | 'Encounter',
  idArg: string
): Promise<void> {
  const room = roomFor(null)
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
 * Commit a cross-entity transfer (`units.transfer`) as ONE batch to the room
 * its units share, and fail if it does not land: the room holds either every
 * op of a stow, a load or a scrap hand-off, or none of them. A room cannot
 * hold half of one, so a transfer between units in two rooms, or one that
 * moves a unit, is refused before anything is sent.
 */
export async function sendTransfer(writes: readonly TransferWrite[]): Promise<void> {
  if (!writable()) return
  const gameId = writes[0]?.gameId ?? null
  if (!writes.every((w) => w.gameId === gameId && w.move === undefined)) {
    throw new RoomDeclined('Both sides of a transfer must be at the same table')
  }
  await roomFor(gameId).submit(writes.map((w) => w.op).filter((op) => !isEmptyOp(op)))
}

/**
 * Send a Downtime step (ADR-063 §6) to its room, and fail if it does not
 * land: the pilot's step op and the mech's share in one batch, each with a
 * stable id (`downtimeStepOpId`), so a step sent twice (a reload, a second
 * tab, a slow read) applies nothing the second time. The step op goes even
 * when it changes nothing (Skip still takes the step); the mech's only with a
 * change. Never queued: Downtime is the table's, so its caller refuses it
 * off `live` (`useGuardedWrite`), and with no room open it fails as offline.
 * True when this call took the step: the room's `ack` names the step op
 * among those it applied, not among those that had landed before.
 */
export async function sendStep(
  gameId: string | null,
  step: OpInput,
  also: readonly OpInput[] = []
): Promise<boolean> {
  const fresh = await roomFor(gameId).submit([step, ...also.filter((op) => !isEmptyOp(op))])
  return fresh.includes(step.id)
}
