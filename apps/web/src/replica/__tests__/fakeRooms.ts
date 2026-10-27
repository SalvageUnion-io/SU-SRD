/**
 * Rooms for a connected test: each Game's room (and the account room, `null`)
 * opened on a fake socket through the real `openRoom`, so `roomOf` finds it.
 * `serve` puts a room's records in place as its snapshot would; every act and
 * ops batch a screen sends is recorded and answered (by `answer`, else with
 * undefined and an ack).
 *
 * Serving and closing run inside `act`, as a room's message would land. Call
 * `closeRooms()` in afterEach.
 */

import { act } from '@testing-library/react'
import { gameScope } from '../replica'
import { openRoom } from '../roomSocket'
import type { StateTable } from '../tableState'
import { forgetTableState, serveTableState } from '../tableState'

/** An act a screen sent: the room it went to (`null`: the account room), its name and args. */
export type SentAct = { gameId: string | null; name: string; args: Record<string, unknown> }

type Body = Record<string, unknown>

/** What an act answers: its value, or a thrown error the room refuses with. */
type Answer = (act: SentAct) => unknown

class FakeSocket {
  static readonly OPEN = 1
  static last: FakeSocket | null = null
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  gameId: string | null = null
  constructor() {
    FakeSocket.last = this
  }
  send(text: string) {
    const said = JSON.parse(text) as {
      type: string
      id?: string
      name?: string
      args?: Body
      ops?: SentBatch['ops']
    }
    const reply = (message: object) =>
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(message) }))
    if (said.type === 'ops') {
      const batch = { gameId: this.gameId, ops: said.ops ?? [] }
      batches.push(batch)
      takeOps(batch)
      reply({ type: 'ack', opIds: (said.ops ?? []).map((op) => op.id) })
      return
    }
    const act: SentAct = { gameId: this.gameId, name: said.name ?? '', args: said.args ?? {} }
    acts.push(act)
    try {
      reply({ type: 'answered', id: said.id, value: answer(act) ?? null })
    } catch (error) {
      reply({ type: 'refused', id: said.id, reason: (error as Error).message })
    }
  }
  close() {}
}

/** Every act sent since the last `closeRooms`, in order. */
export const acts: SentAct[] = []
/** Every ops batch sent since the last `closeRooms`. */
export const batches: SentBatch[] = []

/** An ops batch a screen sent, and the room it went to. */
export type SentBatch = { gameId: string | null; ops: ({ id: string } & Body)[] }

let answer: Answer = () => undefined
let takeOps: (batch: SentBatch) => void = () => undefined
let closers: (() => void)[] = []
const real = globalThis.WebSocket

/** Open each room (a Game's id, or null for the account room) on a fake socket. */
export function openRooms(...gameIds: (string | null)[]): void {
  globalThis.WebSocket = FakeSocket as never
  for (const gameId of gameIds) {
    // Whole, so it needs no page URL to resolve against.
    const path = `http://localhost/__rooms/${gameId === null ? 'account' : `games/${gameId}`}/socket`
    const scope = gameId === null ? 'account' : gameScope(gameId)
    closers.push(openRoom(path, scope, gameId))
    const socket = FakeSocket.last as FakeSocket
    socket.gameId = gameId
    socket.readyState = FakeSocket.OPEN
    socket.onopen?.()
  }
}

/** How the rooms answer each act from now on. */
export function answerActs(next: Answer): void {
  answer = next
}

/** What the rooms do with each ops batch from now on, before they ack it. */
export function answerOps(next: (batch: SentBatch) => void): void {
  takeOps = next
}

/**
 * A room's records, whole, as its snapshot serves them: a list of bodies per
 * table, or one body (or none) for a one-row table. A body's app id is its
 * `_id`, `pilotId`, `userId` or `id`.
 */
export function serve(
  gameId: string | null,
  tables: Partial<Record<StateTable, readonly Body[] | Body | null>>
): void {
  const records = Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => {
      const list = rows === null ? [] : Array.isArray(rows) ? rows : [rows]
      return [table, list.map((body: Body, i) => ({ appId: appIdOf(body, i), body }))]
    })
  )
  act(() => serveTableState(gameId === null ? 'account' : gameScope(gameId), records))
}

function appIdOf(body: Body, index: number): string {
  const id = body._id ?? body.pilotId ?? body.userId ?? body.id ?? body.appId
  return typeof id === 'string' ? id : String(index)
}

/** Close every room, forget what they served and sent, and put the real WebSocket back. */
export function closeRooms(): void {
  for (const close of closers) close()
  closers = []
  acts.length = 0
  batches.length = 0
  answer = () => undefined
  takeOps = () => undefined
  act(() => forgetTableState())
  globalThis.WebSocket = real
}

/** The record table each read answers from, with how its answer becomes the records. */
const READ_TABLES: Record<string, { table: StateTable; records: (answer: unknown) => Body[] }> = {
  'scenes.current': { table: 'scene', records: one },
  'salvageAreas.here': { table: 'salvageArea', records: one },
  'ledger.get': { table: 'ledger', records: one },
  'safety.stopSign': { table: 'safety', records: one },
  'safety.boundaries': { table: 'boundaries', records: list },
  'mediator.npcs': {
    table: 'opposition',
    records: (answer) => list(answer).map((npc) => ({ ...(npc.body as Body), id: npc._id })),
  },
  'seats.forGame': { table: 'seats', records: list },
  'ops.pending': { table: 'proposals', records: list },
  'ops.sent': { table: 'sentProposals', records: list },
  'changeLog.rolls': { table: 'rolls', records: list },
  'changeLog.alerts': { table: 'alerts', records: list },
  'crew.vitals': { table: 'crew', records: one },
  'shelf.patternSharing': { table: 'sharing', records: list },
}

function one(answer: unknown): Body[] {
  return answer === null || answer === undefined ? [] : [answer as Body]
}
function list(answer: unknown): Body[] {
  return (answer ?? []) as Body[]
}

/**
 * Serve a room's records (a Game's, or the account room's for `null`) from what its reads answer, keyed as the server
 * mock's answers are (`'seats.forGame'`); keys that are not a table read are
 * left out. `downtime.state` is the Game's Downtime with `pilotId`'s steps,
 * and `mediator.amMediator` with `mediator.running` the Mediator's record.
 */
export function serveReads(
  gameId: string | null,
  answers: Record<string, unknown>,
  pilotId = ''
): void {
  const tables: Partial<Record<StateTable, Body[]>> = {}
  for (const [name, answer] of Object.entries(answers)) {
    const read = READ_TABLES[name]
    if (read !== undefined && answer !== undefined) tables[read.table] = read.records(answer)
  }
  const downtime = answers['downtime.state'] as (Body & { doneSteps?: number[] }) | undefined
  if (downtime !== undefined) {
    tables.downtime =
      downtime === null ? [] : [{ ...downtime, doneSteps: { [pilotId]: downtime.doneSteps ?? [] } }]
  }
  if (answers['mediator.amMediator'] === true || answers['mediator.running'] != null) {
    tables.mediator = [{ id: 'mediator', running: answers['mediator.running'] ?? null }]
  }
  serve(gameId, tables)
}
