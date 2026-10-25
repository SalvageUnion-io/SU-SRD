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

import type { SoftLink } from 'game-domain/schemas/softLink'
import { captureException } from '../lib/observability'
import { ROOM_PROTOCOL } from '../rooms/presence'
import type { RecordTable, RoomUnit, ServerMessage } from '../rooms/protocol'
import { ServerMessageSchema } from '../rooms/protocol'
import type { Scope, Served, Table } from './replica'
import { release, serve } from './replica'

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
    // Answers to ops this feed does not send yet, and who is here (`useGamePresence`).
    case 'ack':
    case 'declined':
    case 'presence':
      return
  }
}

/** Waits before reopening a dropped socket: doubling, at most 30 s. */
const RETRY_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]

/**
 * Keep a socket open on the room at `path`, folding what it says into
 * `scope`, and reopen it after a drop: each reopening starts with a
 * snapshot, so nothing missed while away is lost. Answers its close.
 */
export function openRoom(path: string, scope: Scope, token: string): () => void {
  const url = new URL(path, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  let socket: WebSocket | null = null
  let retry: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let closed = false
  const connect = () => {
    socket = new WebSocket(url.href, [ROOM_PROTOCOL, token])
    socket.onopen = () => {
      attempt = 0
    }
    socket.onmessage = (event) => {
      let data: unknown
      try {
        data = JSON.parse(String(event.data))
      } catch {
        data = undefined
      }
      foldRoomMessage(scope, data)
    }
    socket.onclose = () => {
      if (closed) return
      retry = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)])
    }
  }
  connect()
  return () => {
    closed = true
    clearTimeout(retry)
    socket?.close(1000)
  }
}
