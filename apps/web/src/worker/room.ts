/**
 * What every room shares (ADR-064): its migrated SQL, its shared rows and
 * their retry, its sockets and its half of the handoff. `./rooms.ts` has the
 * two kinds.
 */

import { DurableObject } from 'cloudflare:workers'
import type { WebSocket as RoomSocket } from '@cloudflare/workers-types'
import type { RoomDump } from '../rooms/dump'
import { dumpRoom, loadRoom } from '../rooms/dump'
import { defectAnswer, readClientMessage, UNREADABLE } from '../rooms/game/feed'
import type { LeaseOutcome, UnitHome, UnitParcel } from '../rooms/handoff'
import type { Migrations } from '../rooms/migrate'
import { migrate } from '../rooms/migrate'
import { ROOM_PROTOCOL } from '../rooms/presence'
import type { ClientMessage } from '../rooms/protocol'
import type { RoomSql } from '../rooms/sql'
import { loadCrewReference } from '../rooms/vitals'
import { reportError } from './errorReports'
import { LEASE_SETTLE_MS, settleStaleOffers } from './leaseAlarm'
import { sendQuietly } from './roomSockets'
import { storageSql } from './roomStorage'
import { homeOf } from './roomStubs'
import type { RoomPublisher } from './shared/roomRows'

type RoomHealth = { schema: number }

/** How long a room waits to write its shared rows again after a write failed. */
const PUBLISH_RETRY_MS = 60_000

/** workerd's global; this workspace's types are the DOM's. */
declare const WebSocketPair: typeof import('@cloudflare/workers-types').WebSocketPair

/** Set by the Worker, never by a client: `serveGameSocket` overwrites them. */
export const MEMBER_HEADER = 'x-su-member'
export const SEAT_HEADER = 'x-su-seat'

/** workerd's `DurableObjectState` and `Env`, however the program types `cloudflare:workers`. */
export type RoomState = ConstructorParameters<typeof DurableObject>[0]
export type RoomEnv = ConstructorParameters<typeof DurableObject>[1]

/** A room's half of the handoff, as its logic keeps it. */
export type RoomTransit = {
  [K in keyof UnitHome]: (...args: Parameters<UnitHome[K]>) => Awaited<ReturnType<UnitHome[K]>>
} & Parameters<typeof settleStaleOffers>[1]

export abstract class Room extends DurableObject<RoomEnv> implements UnitHome {
  protected readonly sql: RoomSql
  private schema = 0

  constructor(
    ctx: RoomState,
    env: RoomEnv,
    private readonly migrations: Migrations
  ) {
    super(ctx, env)
    this.sql = storageSql(ctx.storage)
    // Before the first request is delivered: no request sees an old schema,
    // and every snapshot's vitals and Downtime steps find the reference data.
    void ctx.blockConcurrencyWhile(async () => {
      this.schema = migrate(this.sql, migrations)
      await loadCrewReference()
    })
  }

  health(): RoomHealth {
    return { schema: this.schema }
  }

  /** Every row the room keeps, for the nightly backup (`./shared/backups.ts`). */
  dump(): RoomDump {
    return dumpRoom(this.sql, this.schema)
  }

  /**
   * Replace the room's storage with a backup (an admin's restore): every open
   * socket hears the restored room, and the shared rows follow.
   */
  restore(dump: RoomDump): void {
    loadRoom(this.sql, this.schema, dump)
    this.broadcastSnapshots()
    this.published()
  }

  protected abstract readonly publisher: RoomPublisher

  /** Write every row this room publishes to the shared database now, before a call answers. */
  republish(): Promise<{ sheets: number; homebrew: number }> {
    return this.publisher.republish()
  }

  /** After a change: the shared rows follow, not holding up the answer (no `waitUntil` in a Durable Object). */
  protected published(): void {
    void this.publisher.changed()
  }

  /** The shared rows did not land: the alarm writes them again, unless it is due sooner anyway. */
  protected publishLater(): void {
    const at = Date.now() + PUBLISH_RETRY_MS
    void this.ctx.storage.getAlarm().then(async (due) => {
      if (due === null || due > at) await this.ctx.storage.setAlarm(at)
    })
  }

  protected abstract readonly transit: RoomTransit

  /** Every open socket hears the room afresh; the shared rows follow. */
  protected abstract broadcastSnapshots(): void

  /**
   * One message from a socket the Worker let through, answered on that
   * socket. A defect is reported and still answered (`defectAnswer`), so the
   * client's write fails rather than waiting on an answer that never comes.
   */
  override webSocketMessage(ws: RoomSocket, message: string | ArrayBuffer): void {
    const [member] = this.ctx.getTags(ws)
    const said = member === undefined ? null : readClientMessage(message)
    if (member === undefined || said === null) {
      sendQuietly(ws, JSON.stringify(UNREADABLE))
      return
    }
    try {
      this.heard(ws, member, said)
    } catch (error) {
      reportError(error, { where: 'room.socket', said: said.type })
      sendQuietly(ws, JSON.stringify(defectAnswer(said)))
    }
  }

  /** One `ops` batch or `act` from `member`, answered on `ws`. */
  protected abstract heard(ws: RoomSocket, member: string, said: ClientMessage): void

  offer(args: Parameters<UnitHome['offer']>[0]): UnitParcel {
    const parcel = this.transit.offer(args)
    void this.ctx.storage.setAlarm(Date.now() + LEASE_SETTLE_MS)
    return parcel
  }

  accept(parcel: UnitParcel, actor: string, at: number): void {
    this.transit.accept(parcel, actor, at)
    this.broadcastSnapshots()
  }

  release(leaseId: string): void {
    this.transit.release(leaseId)
    this.broadcastSnapshots()
  }

  cancel(leaseId: string): void {
    this.transit.cancel(leaseId)
  }

  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.transit.refuseLease(leaseId, at)
  }

  /** Settle the offers nobody answered, and write the shared rows again, in case the last write failed. */
  override async alarm(): Promise<void> {
    await settleStaleOffers(this, this.transit, this.ctx.storage, homeOf)
    try {
      await this.publisher.republish()
    } catch (error) {
      reportError(error, { where: 'room.republish' })
      this.publishLater()
    }
  }

  /**
   * The member's socket, which the Worker let through (`MEMBER_HEADER`), or
   * null for a request that is not one.
   */
  protected socketMember(request: Request): string | null {
    const member = request.headers.get(MEMBER_HEADER)
    return request.headers.get('upgrade') === 'websocket' ? member : null
  }

  /** Accept a hibernatable socket tagged `tags`, its first message `first`. */
  protected openSocket(tags: string[], first: unknown): Response {
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1], tags)
    pair[1].send(JSON.stringify(first))
    return new Response(null, {
      status: 101,
      headers: { 'sec-websocket-protocol': ROOM_PROTOCOL },
      webSocket: pair[0],
    } as ResponseInit)
  }

  /** Wipe the room, leaving it as a new one: what is left of a Game that ended. */
  protected async wipe(): Promise<void> {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.schema = migrate(this.sql, this.migrations)
  }
}
