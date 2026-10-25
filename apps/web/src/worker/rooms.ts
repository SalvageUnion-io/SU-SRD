/**
 * The rooms (ADR-064): a SQLite Durable Object per account and per Game,
 * exported from this Worker (`exports` in `wrangler.jsonc`) and reached by
 * name through `cloudflare:workers`' `exports`, so each Preview gets its own namespaces. The
 * logic lives in `../rooms/`, over `RoomSql`; this file is only the wiring.
 */

import { DurableObject, exports } from 'cloudflare:workers'
import type { DurableObjectNamespace, WebSocket as RoomSocket } from '@cloudflare/workers-types'
import type { SheetVitals } from 'game-domain/botWire'
import { applyOp } from 'game-domain/ops/applyOp'
import { AccountRoomLogic } from '../rooms/account/accountRoomLogic'
import { shelfSnapshot } from '../rooms/account/feed'
import type {
  GameActAnswer,
  GameActArgs,
  GameActName,
  GameActResult,
  UnitSheet,
} from '../rooms/game/acts'
import { runAct } from '../rooms/game/acts'
import {
  appliedMessages,
  batchAnswer,
  gameSnapshot,
  readOpsBatch,
  refusedBatch,
  UNREADABLE,
} from '../rooms/game/feed'
import { GameRoomLogic } from '../rooms/game/gameRoomLogic'
import type { UnitRow } from '../rooms/game/store'
import { GameStore } from '../rooms/game/store'
import type { HomeAddress, LeaseOutcome, UnitHome, UnitParcel } from '../rooms/handoff'
import { settleLease } from '../rooms/handoff'
import type { Migrations } from '../rooms/migrate'
import { migrate } from '../rooms/migrate'
import type { PresenceMessage } from '../rooms/presence'
import { presentMembers, ROOM_PROTOCOL, SEAT_TAG, WATCH_TAG } from '../rooms/presence'
import type { ServerMessage } from '../rooms/protocol'
import { RoomRefusal } from '../rooms/refusal'
import { ACCOUNT_ROOM, GAME_ROOM } from '../rooms/schemas'
import type { RoomSql } from '../rooms/sql'
import { unitVitals } from '../rooms/vitals'
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

  constructor(
    ctx: RoomState,
    env: RoomEnv,
    private readonly migrations: Migrations
  ) {
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

  /** Wipe the room, leaving it as a new one: what is left of a Game that ended. */
  protected async wipe(): Promise<void> {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.schema = migrate(this.sql, this.migrations)
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

  /** One of the player's units with its vitals, or null. */
  async unit(
    actor: string,
    unitId: string
  ): Promise<(UnitRow & { vitals: SheetVitals | null }) | null> {
    const unit = this.logic.shelf.list(actor).find((u) => u.id === unitId)
    if (unit === undefined) return null
    return { ...unit, vitals: await unitVitals(this.logic.shelf.store, unitId) }
  }

  /** A disbanded Game's Opposition, filed in its Organizer's NPC tray once per lease. */
  fileTray(leaseId: string, npcs: Record<string, unknown>[], at: number): void {
    this.logic.transit.fileTray(leaseId, npcs, at)
    this.broadcastSnapshots()
  }

  importAccount(bundle: unknown): { imported: boolean } {
    const answer = this.logic.transit.importAccount(bundle, Date.now())
    this.broadcastSnapshots()
    return answer
  }

  offer(args: Parameters<UnitHome['offer']>[0]): UnitParcel {
    const parcel = this.logic.transit.offer(args)
    void this.ctx.storage.setAlarm(Date.now() + LEASE_SETTLE_MS)
    return parcel
  }

  accept(parcel: UnitParcel, actor: string, at: number): void {
    this.logic.transit.accept(parcel, actor, at)
    this.broadcastSnapshots()
  }

  release(leaseId: string): void {
    this.logic.transit.release(leaseId)
    this.broadcastSnapshots()
  }

  cancel(leaseId: string): void {
    this.logic.transit.cancel(leaseId)
  }

  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.logic.transit.refuseLease(leaseId, at)
  }

  override alarm(): Promise<void> {
    return settleStaleOffers(this, this.logic.transit, this.ctx.storage)
  }

  /** The player's socket, which the Worker let through: their Shelf, then its changes. */
  override async fetch(request: Request): Promise<Response> {
    const member = request.headers.get(MEMBER_HEADER)
    if (member === null || request.headers.get('upgrade') !== 'websocket') {
      return new Response(null, { status: 400 })
    }
    if (member !== this.logic.shelf.owner()) return new Response(null, { status: 403 })
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1], [member])
    pair[1].send(JSON.stringify(shelfSnapshot(this.logic, member)))
    return new Response(null, {
      status: 101,
      headers: { 'sec-websocket-protocol': ROOM_PROTOCOL },
      webSocket: pair[0],
    } as ResponseInit)
  }

  /** The player's `ops` batch: applied all or none, answered on its socket, heard by all of theirs. */
  override webSocketMessage(ws: RoomSocket, message: string | ArrayBuffer): void {
    const [member] = this.ctx.getTags(ws)
    const batch = member === undefined ? null : readOpsBatch(message)
    if (member === undefined || batch === null) {
      ws.send(JSON.stringify(UNREADABLE))
      return
    }
    const opIds = batch.map((op) => op.id)
    let result: ReturnType<AccountRoomLogic['shelf']['submit']>
    try {
      result = this.logic.shelf.submit(member, batch)
    } catch (error) {
      if (!(error instanceof RoomRefusal)) throw error
      ws.send(JSON.stringify(refusedBatch(opIds, error.message)))
      return
    }
    if (result.ok) {
      const ids = result.applied.map((op) => op.id)
      sendEach(this.ctx, appliedMessages(this.logic.shelf.store, ids, null))
    }
    ws.send(JSON.stringify(batchAnswer(opIds, result)))
  }

  private broadcastSnapshots(): void {
    snapshotEach(this.ctx, (member) => shelfSnapshot(this.logic, member))
  }
}

/** How long an offer may wait on its target before the alarm settles it. */
const LEASE_SETTLE_MS = 60_000

/**
 * A room's alarm: settle every offer its target never answered, so no unit is
 * left leaving, and come back while any offer is still out.
 */
async function settleStaleOffers(
  home: UnitHome,
  transit: { staleOffers(before: number): { leaseId: string; to: HomeAddress }[] },
  storage: RoomState['storage']
): Promise<void> {
  const now = Date.now()
  for (const { leaseId, to } of transit.staleOffers(now - LEASE_SETTLE_MS + 1)) {
    try {
      await settleLease(home, homeOf(to), leaseId, now)
    } catch (error) {
      console.error('settling a lease failed', leaseId, error)
    }
  }
  if (transit.staleOffers(Number.MAX_SAFE_INTEGER).length > 0) {
    await storage.setAlarm(now + LEASE_SETTLE_MS)
  }
}

/** What the Game room asks of a player's account room: the handoff, and the Opposition tray at a Game's end. */
type AccountHome = UnitHome & {
  fileTray(leaseId: string, npcs: Record<string, unknown>[], at: number): Promise<void>
}

/**
 * @public A Game; loaded by workerd (`wrangler.jsonc` `exports`), named by
 * its Game id. The Worker and the bot name the player (`actor`, a Discord id,
 * ADR-064 §5); the room enforces their role and takes the time itself.
 */
export class GameRoom extends Room implements UnitHome {
  private readonly logic: GameRoomLogic

  constructor(ctx: RoomState, env: RoomEnv) {
    super(ctx, env, GAME_ROOM)
    this.logic = new GameRoomLogic(this.sql, { applyOp })
  }

  private get gameId(): string {
    const name = this.ctx.id.name
    if (name === undefined) throw new Error('A Game room is reached by its Game id')
    return name
  }

  /**
   * One member's act, by name (`GAME_ACTS`); a refusal comes back as an
   * answer. Every open socket then hears what changed.
   */
  act<N extends GameActName>(
    actor: string,
    name: N,
    args: GameActArgs<N>
  ): GameActAnswer<GameActResult<N>> {
    const answer = runAct(
      { room: this.logic, actor, gameId: this.gameId, at: Date.now() },
      name,
      args
    )
    if (answer.ok && !READ_ACTS.has(name)) {
      const result = answer.value as GameActResult<'submit'>
      if (name !== 'submit') this.broadcastSnapshots()
      else if (result.ok) {
        const ids = result.applied.map((op) => op.id)
        this.broadcast(appliedMessages(this.logic.store, ids, this.gameId))
      }
    }
    return answer
  }

  /** The actor's own units and the primary crawler, for the bot's sheets. */
  unitsFor(actor: string): UnitSheet[] {
    const answer = this.act(actor, 'unitsFor', undefined as never)
    return answer.ok ? answer.value : []
  }

  /** One unit a member may see, with its holder's name and its vitals; null otherwise. */
  async unit(
    actor: string,
    unitId: string
  ): Promise<(NonNullable<GameActResult<'unit'>> & { vitals: SheetVitals | null }) | null> {
    const answer = this.act(actor, 'unit', { unitId })
    if (!answer.ok || answer.value === null) return null
    return { ...answer.value, vitals: await unitVitals(new GameStore(this.sql), unitId) }
  }

  offer(args: Parameters<UnitHome['offer']>[0]): UnitParcel {
    const parcel = this.logic.transit.offer(args)
    void this.ctx.storage.setAlarm(Date.now() + LEASE_SETTLE_MS)
    return parcel
  }

  accept(parcel: UnitParcel, actor: string, at: number): void {
    this.logic.transit.accept(parcel, actor, at)
    this.broadcastSnapshots()
  }

  release(leaseId: string): void {
    this.logic.transit.release(leaseId)
    this.broadcastSnapshots()
  }

  cancel(leaseId: string): void {
    this.logic.transit.cancel(leaseId)
  }

  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.logic.transit.refuseLease(leaseId, at)
  }

  override alarm(): Promise<void> {
    return settleStaleOffers(this, this.logic.transit, this.ctx.storage)
  }

  /**
   * End the Game (Organizer only): every unit goes to its holder's Training
   * Bay, the rest and the tray to the Organizer's, then the room is wiped.
   * A retry after a failed delivery delivers only what had not landed.
   */
  async disband(actor: string): Promise<GameActAnswer<null>> {
    const at = Date.now()
    let ended: ReturnType<GameRoomLogic['roster']['disband']>
    try {
      ended = this.logic.roster.disband(actor, at)
    } catch (error) {
      if (error instanceof RoomRefusal) return { ok: false, refusal: error.message }
      throw error
    }
    for (const { to, parcel } of ended.deliveries) {
      await accountHome(to).accept(parcel, to, at)
    }
    await accountHome(ended.tray.to).fileTray(`disband-tray:${this.gameId}`, ended.tray.npcs, at)
    await this.wipe()
    return { ok: true, value: null }
  }

  /** A member deleted their account; a Game left with nobody is wiped. */
  async forget(userId: string): Promise<void> {
    if (this.logic.roster.forgetMember(userId).empty) await this.wipe()
  }

  /** The cutover: copy one Game's bundle in, once (ADR-064 §7). */
  importGame(bundle: unknown): { imported: boolean } {
    return this.logic.transit.importGame(bundle, Date.now())
  }

  /** What differs between this room and the bundle it was imported from; empty when they agree. */
  diffImport(bundle: Parameters<GameRoomLogic['transit']['diffImport']>[0]): string[] {
    return this.logic.transit.diffImport(bundle)
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
    pair[1].send(JSON.stringify(gameSnapshot(this.logic, member, this.gameId)))
    this.broadcastPresence()
    return new Response(null, {
      status: 101,
      headers: { 'sec-websocket-protocol': ROOM_PROTOCOL },
      webSocket: pair[0],
    } as ResponseInit)
  }

  /** A member's `ops` batch: applied all or none, answered on its socket, heard by all. */
  override webSocketMessage(ws: RoomSocket, message: string | ArrayBuffer): void {
    const [member] = this.ctx.getTags(ws)
    const batch = member === undefined ? null : readOpsBatch(message)
    if (member === undefined || batch === null) {
      ws.send(JSON.stringify(UNREADABLE))
      return
    }
    const opIds = batch.map((op) => op.id)
    const answer = this.act(member, 'submit', { ops: batch })
    ws.send(
      JSON.stringify(
        answer.ok ? batchAnswer(opIds, answer.value) : refusedBatch(opIds, answer.refusal)
      )
    )
  }

  override webSocketClose(ws: RoomSocket): void {
    this.broadcastPresence(ws)
  }

  override webSocketError(ws: RoomSocket): void {
    this.broadcastPresence(ws)
  }

  private broadcastSnapshots(): void {
    snapshotEach(this.ctx, (member) => gameSnapshot(this.logic, member, this.gameId))
  }

  private broadcast(messages: readonly ServerMessage[]): void {
    sendEach(this.ctx, messages)
  }

  /** Who is here, to every open socket but `gone` (the one closing). */
  private broadcastPresence(gone?: RoomSocket): void {
    const open = this.ctx.getWebSockets().filter((ws) => ws !== gone)
    const message: PresenceMessage = {
      type: 'presence',
      here: presentMembers(open.map((ws) => this.ctx.getTags(ws))),
    }
    const text = JSON.stringify(message)
    for (const ws of open) sendQuietly(ws, text)
  }
}

/** The acts that change nothing a socket carries. */
const READ_ACTS: ReadonlySet<GameActName> = new Set<GameActName>([
  'read',
  'members',
  'invitePreview',
  'inviteCode',
  'units',
  'links',
  'history',
  'pendingProposals',
  'sentProposals',
  'seats',
  'downtime',
  'tray',
  'runningEncounter',
  'unitsFor',
  'unit',
])

/** Each open socket's own snapshot, after a change that may touch several things. */
function snapshotEach(ctx: RoomState, snapshotOf: (member: string) => ServerMessage): void {
  const byMember = new Map<string, string>()
  for (const ws of ctx.getWebSockets()) {
    const [member] = ctx.getTags(ws)
    if (member === undefined) continue
    let text = byMember.get(member)
    if (text === undefined) {
      text = JSON.stringify(snapshotOf(member))
      byMember.set(member, text)
    }
    sendQuietly(ws as RoomSocket, text)
  }
}

/** The same messages to every open socket. */
function sendEach(ctx: RoomState, messages: readonly ServerMessage[]): void {
  const texts = messages.map((message) => JSON.stringify(message))
  for (const ws of ctx.getWebSockets())
    for (const text of texts) sendQuietly(ws as RoomSocket, text)
}

function sendQuietly(ws: RoomSocket, text: string): void {
  try {
    ws.send(text)
  } catch {
    // Closing as we sent; its own close handler answers the rest.
  }
}

/** The room namespaces, as `wrangler.jsonc` declares them. */
function rooms() {
  return exports as unknown as {
    AccountRoom: DurableObjectNamespace<AccountRoom>
    GameRoom: DurableObjectNamespace<GameRoom>
  }
}

/**
 * A Game room's stub as its callers use it. workerd's own stub type drops a
 * result holding `unknown` (a unit's body) to `never`; every value here is
 * plain JSON, so each method answers its own result.
 */
export type GameRoomStub = {
  [K in 'unitsFor' | 'unit' | 'disband' | 'forget' | 'importGame' | 'diffImport']: (
    ...args: Parameters<GameRoom[K]>
  ) => Promise<Awaited<ReturnType<GameRoom[K]>>>
} & {
  act<N extends GameActName>(
    actor: string,
    name: N,
    args: GameActArgs<N>
  ): Promise<GameActAnswer<GameActResult<N>>>
} & {
  [K in keyof UnitHome]: (
    ...args: Parameters<UnitHome[K]>
  ) => Promise<Awaited<ReturnType<UnitHome[K]>>>
}

/** The Game room named `gameId`. */
function gameRoom(gameId: string): GameRoomStub {
  return rooms().GameRoom.getByName(gameId) as unknown as GameRoomStub
}

/** The room a unit lives in, as the other side of a handoff. */
function homeOf(address: HomeAddress): UnitHome {
  return address.kind === 'game' ? gameRoom(address.gameId) : accountHome(address.userId)
}

/** A player's account room, by Discord id. */
function accountHome(userId: string): AccountHome {
  return rooms().AccountRoom.getByName(userId) as unknown as AccountHome
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
