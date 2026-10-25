/**
 * The rooms (ADR-064): a SQLite Durable Object per account and per Game,
 * exported from this Worker (`exports` in `wrangler.jsonc`) and reached by
 * name through `cloudflare:workers`' `exports`, so each Preview gets its own namespaces. The
 * logic lives in `../rooms/`, over `RoomSql`; this file is only the wiring.
 */

import { DurableObject, exports } from 'cloudflare:workers'
import type { DurableObjectNamespace, WebSocket as RoomSocket } from '@cloudflare/workers-types'
import { applyOp } from 'game-domain/ops/applyOp'
import { AccountRoomLogic } from '../rooms/account/accountRoomLogic'
import type { UnitRow } from '../rooms/game/store'
import type { LeaseOutcome, UnitHome, UnitParcel } from '../rooms/handoff'
import type { Migrations } from '../rooms/migrate'
import { migrate } from '../rooms/migrate'
import type { PresenceMessage } from '../rooms/presence'
import { presentMembers, ROOM_PROTOCOL, SEAT_TAG, WATCH_TAG } from '../rooms/presence'
import { ACCOUNT_ROOM, GAME_ROOM } from '../rooms/schemas'
import type { RoomSql } from '../rooms/sql'
import { roomMember } from './roomAuth'

type RoomHealth = { schema: number }

/** workerd's global; this workspace's types are the DOM's. */
declare const WebSocketPair: typeof import('@cloudflare/workers-types').WebSocketPair

/** Set by the Worker, never by a client: `serveGameSocket` overwrites them. */
const MEMBER_HEADER = 'x-su-member'
const SEAT_HEADER = 'x-su-seat'

/** workerd's `DurableObjectState` and `Env`, however the program types `cloudflare:workers`. */
type RoomState = ConstructorParameters<typeof DurableObject>[0]
type RoomEnv = ConstructorParameters<typeof DurableObject>[1]

function storageSql(storage: RoomState['storage']): RoomSql {
  return {
    exec: (query, ...bindings) => storage.sql.exec(query, ...bindings).toArray() as never,
    transaction: (fn) => storage.transactionSync(fn),
  }
}

abstract class Room extends DurableObject<RoomEnv> {
  protected readonly sql: RoomSql
  private schema = 0

  constructor(ctx: RoomState, env: RoomEnv, migrations: Migrations) {
    super(ctx, env)
    this.sql = storageSql(ctx.storage)
    // Before the first request is delivered: no request sees an old schema.
    void ctx.blockConcurrencyWhile(async () => {
      this.schema = migrate(this.sql, migrations)
    })
  }

  health(): RoomHealth {
    return { schema: this.schema }
  }
}

/**
 * @public A player's shelf, named by their Discord id; loaded by workerd
 * (`wrangler.jsonc` `exports`). Its RPC is the player's units, the handoff
 * (`UnitHome`) and the cutover's import; the Worker names the actor.
 */
export class AccountRoom extends Room implements UnitHome {
  private readonly logic: AccountRoomLogic

  constructor(ctx: RoomState, env: RoomEnv) {
    super(ctx, env, ACCOUNT_ROOM)
    this.logic = new AccountRoomLogic(this.sql, { applyOp })
    // The room is named by its player, so it is theirs before they first open
    // it: a Game that ends can hand them their units (after the migration above).
    void ctx.blockConcurrencyWhile(async () => {
      if (ctx.id.name !== undefined) this.logic.shelf.claim(ctx.id.name, Date.now())
    })
  }

  /** The player's own units; anyone else is answered none. */
  unitsFor(actor: string): UnitRow[] {
    return this.logic.shelf.list(actor)
  }

  /** One of the player's units, or null. */
  unit(actor: string, unitId: string): UnitRow | null {
    return this.logic.shelf.list(actor).find((u) => u.id === unitId) ?? null
  }

  /** A disbanded Game's Opposition, filed in its Organizer's NPC tray once per lease. */
  fileTray(leaseId: string, npcs: Record<string, unknown>[], at: number): void {
    this.logic.transit.fileTray(leaseId, npcs, at)
  }

  importAccount(bundle: unknown): { imported: boolean } {
    return this.logic.transit.importAccount(bundle, Date.now())
  }

  offer(args: Parameters<UnitHome['offer']>[0]): UnitParcel {
    return this.logic.transit.offer(args)
  }

  accept(parcel: UnitParcel, actor: string, at: number): void {
    this.logic.transit.accept(parcel, actor, at)
  }

  release(leaseId: string): void {
    this.logic.transit.release(leaseId)
  }

  cancel(leaseId: string): void {
    this.logic.transit.cancel(leaseId)
  }

  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.logic.transit.refuseLease(leaseId, at)
  }
}

/** @public A Game; loaded by workerd (`wrangler.jsonc` `exports`). */
export class GameRoom extends Room {
  constructor(ctx: RoomState, env: RoomEnv) {
    super(ctx, env, GAME_ROOM)
  }

  /**
   * A socket for a member the Worker let through: hibernatable, tagged with
   * who and whether it is a seat (here) or a watcher.
   */
  override async fetch(request: Request): Promise<Response> {
    const member = request.headers.get(MEMBER_HEADER)
    if (member === null || request.headers.get('upgrade') !== 'websocket') {
      return new Response(null, { status: 400 })
    }
    const role = request.headers.get(SEAT_HEADER) === '1' ? SEAT_TAG : WATCH_TAG
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1], [member, role])
    this.broadcastPresence()
    return new Response(null, {
      status: 101,
      headers: { 'sec-websocket-protocol': ROOM_PROTOCOL },
      webSocket: pair[0],
    } as ResponseInit)
  }

  override webSocketClose(ws: RoomSocket): void {
    this.broadcastPresence(ws)
  }

  override webSocketError(ws: RoomSocket): void {
    this.broadcastPresence(ws)
  }

  /** Who is here, to every open socket but `gone` (the one closing). */
  private broadcastPresence(gone?: RoomSocket): void {
    const open = this.ctx.getWebSockets().filter((ws) => ws !== gone)
    const message: PresenceMessage = {
      type: 'presence',
      here: presentMembers(open.map((ws) => this.ctx.getTags(ws))),
    }
    const text = JSON.stringify(message)
    for (const ws of open) {
      try {
        ws.send(text)
      } catch {
        // Closing as we sent; its own close handler sends the next answer.
      }
    }
  }
}

/** The room namespaces, as `wrangler.jsonc` declares them. */
function rooms() {
  return exports as unknown as {
    AccountRoom: DurableObjectNamespace<AccountRoom>
    GameRoom: DurableObjectNamespace<GameRoom>
  }
}

export async function serveRoomsHealth(): Promise<Response> {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }
  try {
    const [account, game] = await Promise.all([
      rooms().AccountRoom.getByName('health').health(),
      rooms().GameRoom.getByName('health').health(),
    ])
    return new Response(JSON.stringify({ account, game }), { headers })
  } catch (error) {
    console.error('rooms health failed', error)
    return new Response(JSON.stringify({ error: 'rooms_unavailable' }), { status: 503, headers })
  }
}

/** A member's socket to their Game's room (`?seat=1`: they count as here); anyone else a 403. */
export async function serveGameSocket(
  request: Request,
  gameId: string,
  env: { CONVEX_URL?: string }
): Promise<Response> {
  if (request.headers.get('upgrade') !== 'websocket') return new Response(null, { status: 426 })
  const member = await roomMember(request, env, gameId)
  if (member === null) return new Response(null, { status: 403 })
  const headers = new Headers(request.headers)
  headers.set(MEMBER_HEADER, member)
  headers.set(SEAT_HEADER, new URL(request.url).searchParams.get('seat') === '1' ? '1' : '0')
  const room = rooms().GameRoom.getByName(gameId)
  // The stub's fetch speaks workerd's Request and Response, the same objects at run time.
  const forward = room.fetch.bind(room) as unknown as (req: Request) => Promise<Response>
  return forward(new Request(request, { headers }))
}
