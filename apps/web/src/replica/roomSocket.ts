/**
 * What the room sockets say, folded into the replica (`rooms/protocol.ts`):
 * the account room is the `account` scope and each Game room a scope of its
 * own (`gameScope`), so one room's snapshot never takes another's rows.
 *
 *  - `snapshot` serves the room's scope whole: every unit table, its links
 *    and each record table it keeps.
 *  - `applied` and `record` adopt one row, under the room's scope, when it is
 *    newer than the one held (`serve`).
 *  - `gone` and `recordGone` take the room's claim off one row.
 *  - `links` serves the room's whole link set.
 *
 * Framework-free: `RoomFeed` mounts the sockets (`openRoom`).
 */

import type { OpInput } from 'game-domain/ops/applyOp'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { captureException } from '../lib/observability'
import { ROOM_PROTOCOL } from '../rooms/presence'
import type { RecordTable, RoomUnit, ServerMessage } from '../rooms/protocol'
import { ServerMessageSchema } from '../rooms/protocol'
import type { Scope, Served, Table } from './replica'
import { release, serve } from './replica'
import { WritesBlockedOffline } from './sync'

/** Whether this build's replica is fed by the rooms (`RoomFeed`). */
export const ROOM_FEED = import.meta.env.VITE_ROOM_FEED === '1'

const UNIT_TABLES = ['pilot', 'mech', 'crawler', 'npc'] as const satisfies readonly Table[]

/**
 * The replica's table for each record table a room keeps. A Game's
 * Opposition has none yet: the Mediator's screen reads it from Convex.
 */
const RECORD_TABLE: Record<RecordTable, Table | null> = {
  patterns: 'mechPattern',
  encounters: 'encounter',
  npcTray: 'encounterNpc',
  opposition: null,
}

type RoomLink = Extract<ServerMessage, { type: 'links' }>['links'][number]
type RoomRecord = Extract<ServerMessage, { type: 'record' }>['record']

/** A unit as served: its Game is the room's column, the authority over its body. */
function servedUnit(unit: RoomUnit): Served {
  return {
    table: unit.kind,
    row: { ...unit.body, id: unit.appId, gameId: unit.gameId },
    version: unit.updatedAt,
    headSeq: unit.headSeq,
  }
}

function servedRecord(table: Table, record: RoomRecord): Served {
  return { table, row: { ...record.body, id: record.appId }, version: record.updatedAt }
}

function servedLink(link: RoomLink): Served {
  const row: SoftLink = {
    id: link.id,
    type: link.type as SoftLink['type'],
    from: link.from as SoftLink['from'],
    to: link.to as SoftLink['to'],
    ...(link.slot === undefined ? {} : { slot: link.slot as SoftLink['slot'] }),
    createdAt: link.createdAt,
  }
  return { table: 'softLink', row, version: Date.parse(link.createdAt) }
}

/** Fold one message from the room serving `scope`; one that does not parse is reported and skipped. */
export function foldRoomMessage(scope: Scope, data: unknown): void {
  const parsed = ServerMessageSchema.safeParse(data)
  if (!parsed.success) {
    captureException(
      new Error('[replica] A room sent a message that does not parse', { cause: parsed.error })
    )
    return
  }
  const message = parsed.data
  switch (message.type) {
    case 'snapshot': {
      const records = Object.entries(message.records).flatMap(([name, rows]) => {
        const table = RECORD_TABLE[name as RecordTable]
        return table === null ? [] : [{ table, rows: rows ?? [] }]
      })
      serve(
        scope,
        [...UNIT_TABLES, 'softLink', ...records.map((r) => r.table)],
        [
          ...message.units.map(servedUnit),
          ...message.links.map(servedLink),
          ...records.flatMap((r) => r.rows.map((record) => servedRecord(r.table, record))),
        ]
      )
      return
    }
    case 'applied':
      serve(scope, [], [servedUnit(message.unit)])
      return
    case 'gone':
      release(scope, message.kind, message.appId)
      return
    case 'record': {
      const table = RECORD_TABLE[message.table]
      if (table !== null) serve(scope, [], [servedRecord(table, message.record)])
      return
    }
    case 'recordGone': {
      const table = RECORD_TABLE[message.table]
      if (table !== null) release(scope, table, message.appId)
      return
    }
    case 'links':
      serve(scope, ['softLink'], message.links.map(servedLink))
      return
    // A batch's answer is its socket's (`openRoom`); who is here, `useGamePresence`'s.
    case 'ack':
    case 'declined':
    case 'presence':
      return
  }
}

/** Waits before reopening a dropped socket: doubling, at most 30 s. */
const RETRY_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]

/** A batch sent and not yet answered, keyed by its first op's id; a null refusal is its ack. */
type Batch = { ops: readonly OpInput[]; settle: (refusal: Error | null) => void }

/** A room this tab holds open, to send its ops. */
type Room = { submit(ops: readonly OpInput[]): Promise<void> }

/**
 * The open Game rooms, by Game id. The account room is not one yet: it
 * takes ops only once its socket signs in at the Worker, so a Shelf unit
 * still writes through Convex.
 */
const open = new Map<string, Room>()

/** The room a unit in `gameId` (null: on the Shelf) is written through, while its socket is open. */
export function roomOf(gameId: string | null): Room | null {
  return gameId === null ? null : (open.get(gameId) ?? null)
}

/** A batch the room declined: its reason is the refusal the player is shown. */
export class RoomDeclined extends Error {}

/**
 * Keep a socket open on the room at `path`, folding what it says into
 * `scope`, and reopen it after a drop: each reopening starts with a
 * snapshot, so nothing missed while away is lost. While open, it is the
 * room `roomOf(gameId)` sends ops through: a batch waits for its `ack` or
 * `declined`, and one in flight when the socket drops goes again when it reopens
 * (an op id is idempotent, so a batch the room had already applied is safe
 * to send again). Answers its close.
 */
export function openRoom(
  path: string,
  scope: Scope,
  token: string,
  gameId: string | null = null
): () => void {
  const url = new URL(path, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const waiting = new Map<string, Batch>()
  let socket: WebSocket | null = null
  let retry: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let closed = false
  const send = (ops: readonly OpInput[]) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ops', ops }))
  }
  const answer = (opIds: readonly string[], refusal: Error | null) => {
    const batch = waiting.get(opIds[0] ?? '')
    if (batch === undefined) return
    waiting.delete(opIds[0] as string)
    batch.settle(refusal)
  }
  const connect = () => {
    socket = new WebSocket(url.href, [ROOM_PROTOCOL, token])
    socket.onopen = () => {
      attempt = 0
      if (gameId !== null) open.set(gameId, room)
      for (const batch of waiting.values()) send(batch.ops)
    }
    socket.onmessage = (event) => {
      let data: unknown
      try {
        data = JSON.parse(String(event.data))
      } catch {
        data = undefined
      }
      const reply = data as { type?: unknown; opIds?: string[]; reason?: string } | undefined
      if (reply?.type === 'ack') answer(reply.opIds ?? [], null)
      else if (reply?.type === 'declined')
        answer(reply.opIds ?? [], new RoomDeclined(reply.reason ?? ''))
      else foldRoomMessage(scope, data)
    }
    socket.onclose = () => {
      if (gameId !== null && open.get(gameId) === room) open.delete(gameId)
      if (closed) return
      retry = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)])
    }
  }
  const room: Room = {
    submit: (ops) =>
      new Promise((resolve, reject) => {
        const first = ops[0]
        if (first === undefined) return resolve()
        waiting.set(first.id, {
          ops,
          settle: (refusal) => (refusal === null ? resolve() : reject(refusal)),
        })
        send(ops)
      }),
  }
  connect()
  return () => {
    closed = true
    clearTimeout(retry)
    if (gameId !== null && open.get(gameId) === room) open.delete(gameId)
    socket?.close(1000)
    // Nothing will answer these now: the edit fails as one made offline does,
    // rather than hang, and an outbox op stays queued for the next send.
    for (const batch of waiting.values()) batch.settle(new WritesBlockedOffline())
    waiting.clear()
  }
}
