/**
 * The rooms (ADR-064): a SQLite Durable Object per account and per Game,
 * exported from this Worker (`exports` in `wrangler.jsonc`) and reached by
 * name through `cloudflare:workers`' `exports`, so each Preview gets its own namespaces. The
 * logic lives in `../rooms/`, over `RoomSql`; this file is only the wiring.
 */

import type { WebSocket as RoomSocket } from '@cloudflare/workers-types'
import type { SheetVitals } from 'game-domain/botWire'
import { applyOp } from 'game-domain/ops/applyOp'
import { isDowntimeStepOp } from 'game-domain/ops/downtimeStep'
import { AccountRoomLogic } from '../rooms/account/accountRoomLogic'
import { ACCOUNT_ACTS, ACCOUNT_READ_ACTS } from '../rooms/account/acts'
import { shelfSnapshot } from '../rooms/account/feed'
import type { AccountShelf, Profile, ShelfExport } from '../rooms/account/shelf'
import type {
  GameActAnswer,
  GameActArgs,
  GameActName,
  GameActResult,
  UnitSheet,
} from '../rooms/game/acts'
import { GAME_READ_ACTS, runAct } from '../rooms/game/acts'
import {
  appliedMessages,
  batchAnswer,
  crewRecord,
  defectAnswer,
  gameSnapshot,
  refusedBatch,
} from '../rooms/game/feed'
import { GameRoomLogic } from '../rooms/game/gameRoomLogic'
import {
  ACCOUNT_SOCKET_ACTS,
  actAnswer,
  GAME_SOCKET_ACTS,
  socketAct,
} from '../rooms/game/socketActs'
import type { UnitRow } from '../rooms/game/store'
import { GameStore } from '../rooms/game/store'
import type { PresenceMessage } from '../rooms/presence'
import { presentMembers, SEAT_TAG, WATCH_TAG } from '../rooms/presence'
import type { ClientMessage, ServerMessage } from '../rooms/protocol'
import { gamePublished, shelfPublished } from '../rooms/publish'
import { answerOrRefuse } from '../rooms/refusal'
import { ACCOUNT_ROOM, GAME_ROOM } from '../rooms/schemas'
import { unitVitals } from '../rooms/vitals'
import { reportError } from './errorReports'
import { builtMech, countPatternBuild } from './patternBuilds'
import type { RoomEnv, RoomState, RoomTransit } from './room'
import { Room, SEAT_HEADER } from './room'
import { closeGone, sendEach, sendQuietly, snapshotEach } from './roomSockets'
import { accountHome } from './roomStubs'
import { membershipGameIds } from './shared/games'
import { RoomPublisher, sharedDb } from './shared/roomRows'
import { AccountTotalsWriter } from './shared/signals'
import type { StopSignEnv } from './shared/stopSign'
import { postStopSign } from './shared/stopSign'
import { isShelfAct, runShelfAct } from './shelfActs'

/**
 * @public A player's shelf, named by their Discord id; loaded by workerd
 * (`wrangler.jsonc` `exports`). Its RPC is the player's units, their profile
 * and the handoff (`UnitHome`); the Worker names the actor.
 */
export class AccountRoom extends Room {
  private readonly logic: AccountRoomLogic
  protected readonly publisher: RoomPublisher
  protected readonly transit: RoomTransit
  private readonly totals: AccountTotalsWriter

  constructor(ctx: RoomState, env: RoomEnv) {
    super(ctx, env, ACCOUNT_ROOM)
    this.logic = new AccountRoomLogic(this.sql, { applyOp })
    this.transit = this.logic.transit
    this.totals = new AccountTotalsWriter(sharedDb(env), () => {
      const discordId = this.logic.shelf.owner()
      return discordId === null ? null : { discordId, ...this.logic.shelf.totals() }
    })
    const owner = ctx.id.name ?? null
    this.publisher = new RoomPublisher(
      sharedDb(env),
      `account:${owner}`,
      owner,
      () => shelfPublished(this.logic.shelf.store),
      () => this.publishLater()
    )
    // The room is named by its player, so it is theirs before they first open
    // it: a Game that ends can hand them their units (after the migration above).
    void ctx.blockConcurrencyWhile(async () => {
      if (ctx.id.name !== undefined) this.logic.shelf.claim(ctx.id.name, Date.now())
    })
  }

  /** After a change: the shared rows follow, and the player's totals when they moved. */
  protected override published(): void {
    super.published()
    void this.totals.write()
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

  /** The player's socket, which the Worker let through: their Shelf, then its changes. */
  override async fetch(request: Request): Promise<Response> {
    const member = this.socketMember(request)
    if (member === null) return new Response(null, { status: 400 })
    if (member !== this.logic.shelf.owner()) return new Response(null, { status: 403 })
    const socket = this.openSocket([member], shelfSnapshot(this.logic, member))
    // A player who has never changed a thing still counts as an account.
    void this.totals.write()
    void this.seedGames().catch((error) => reportError(error, { where: 'room.seedGames' }))
    return socket
  }

  /** Once per room: the Games the shared database has the player in, from before the room kept its own list. */
  private async seedGames(): Promise<void> {
    const owner = this.logic.shelf.owner()
    const db = sharedDb(this.env)
    if (owner === null || db === undefined || !this.logic.games.needsSeed()) return
    this.logic.games.seed(await membershipGameIds(db, owner), Date.now())
  }

  /**
   * The player's `ops` batch (applied all or none) or `act` (their solo
   * area's or their Shelf's, `./shelfActs.ts`), answered on its socket, heard
   * by all of theirs.
   */
  protected heard(ws: RoomSocket, member: string, said: ClientMessage): void {
    if (said.type === 'act') {
      const act = socketAct(said, ACCOUNT_SOCKET_ACTS)
      if (!('refusal' in act) && isShelfAct(act)) {
        const answered = (answer: GameActAnswer<unknown>) => {
          if (answer.ok) this.broadcastSnapshots()
          sendQuietly(ws, JSON.stringify(actAnswer(said.id, answer)))
        }
        const broken = () => sendQuietly(ws, JSON.stringify(defectAnswer(said)))
        runShelfAct(this.logic, sharedDb(this.env), member, act, answered, broken)
      } else {
        const answer = 'refusal' in act ? { ok: false as const, ...act } : this.soloAct(member, act)
        ws.send(JSON.stringify(actAnswer(said.id, answer)))
      }
      return
    }
    const batch = said.ops
    const opIds = batch.map((op) => op.id)
    const submitted = answerOrRefuse(() => this.logic.shelf.submit(member, batch))
    if (!submitted.ok) {
      ws.send(JSON.stringify(refusedBatch(opIds, submitted.refusal)))
      return
    }
    const result = submitted.value
    if (result.ok) {
      const ids = result.applied.map((op) => op.id)
      sendEach(this.ctx, appliedMessages(this.logic.shelf.store, ids, null), (m) => this.mine(m))
      // A solo Downtime step is read back off its op (the seat's `doneSteps`).
      if (ids.some(isDowntimeStepOp)) this.broadcastSnapshots()
      else this.published()
    }
    ws.send(JSON.stringify(batchAnswer(opIds, result)))
  }

  /** One act on the player's solo table (not the Shelf's); every socket of theirs then hears their Shelf. */
  private soloAct(
    member: string,
    act: Exclude<ReturnType<typeof socketAct<typeof ACCOUNT_SOCKET_ACTS>>, { refusal: string }>
  ): GameActAnswer<unknown> {
    const name = act.name as keyof typeof ACCOUNT_ACTS
    const run = ACCOUNT_ACTS[name] as (c: unknown, a: unknown) => unknown
    const built = name === 'createUnit' ? builtMech(this.logic, act.args) : null
    const answer = answerOrRefuse(() =>
      run({ room: this.logic, actor: member, at: Date.now() }, act.args)
    )
    if (answer.ok && !ACCOUNT_READ_ACTS.has(name)) this.broadcastSnapshots()
    if (answer.ok && name === 'downtime.begin' && answer.value === true) {
      this.countUsage('downtime:solo')
    }
    if (answer.ok && built !== null) {
      countPatternBuild(this, sharedDb(this.env), accountHome, built, member)
    }
    return answer
  }

  /** Count a mech built from one of the player's patterns; false when it is not here. */
  countBuild(patternId: string, builder: string): boolean {
    const counted = this.logic.sharing.countBuild(patternId, builder, Date.now())
    if (counted) this.broadcastSnapshots()
    return counted
  }

  /** The player's own name and avatar overrides; anyone else, null. */
  profile(actor: string): Profile | null {
    return this.logic.shelf.profile(actor)
  }

  /** Set the player's name or avatar override; their shared sheets follow. */
  setProfile(actor: string, patch: Parameters<AccountShelf['setProfile']>[1]): void {
    this.logic.shelf.setProfile(actor, patch)
    this.published()
  }

  /** What the player owns on their Shelf, for their export; anyone else, null. */
  exportFor(actor: string): ShelfExport | null {
    return this.logic.shelf.exportFor(actor)
  }

  /** The player is in Game `gameId`, or is about to be: the Worker notes it before the create or join. */
  joinedGame(gameId: string): void {
    this.logic.games.joined(gameId, Date.now())
  }

  /** The player is no longer in Game `gameId`: it ended. */
  leftGame(gameId: string): void {
    this.logic.games.left(gameId)
  }

  /** Every Game this room has noted the player in, for account deletion. */
  gameIds(): string[] {
    return this.logic.games.list()
  }

  /**
   * The player deleted their account: the room is wiped, and theirs again
   * at once, empty, so signing straight back in finds it as a new player's.
   */
  async forget(actor: string): Promise<void> {
    if (this.logic.shelf.owner() === actor) {
      await this.wipe()
      this.logic.shelf.claim(actor, Date.now())
    }
    this.broadcastSnapshots()
  }

  /** Whether `member` is this room's player. */
  private mine(member: string): boolean {
    return member === this.logic.shelf.owner()
  }

  protected broadcastSnapshots(): void {
    snapshotEach(this.ctx, (member) => shelfSnapshot(this.logic, member))
    this.published()
  }
}

/**
 * @public A Game; loaded by workerd (`wrangler.jsonc` `exports`), named by
 * its Game id. The Worker and the bot name the player (`actor`, a Discord id,
 * ADR-064 §5); the room enforces their role and takes the time itself.
 */
export class GameRoom extends Room {
  private readonly logic: GameRoomLogic
  protected readonly publisher: RoomPublisher
  protected readonly transit: RoomTransit

  constructor(ctx: RoomState, env: RoomEnv) {
    super(ctx, env, GAME_ROOM)
    this.logic = new GameRoomLogic(this.sql, { applyOp })
    this.transit = this.logic.transit
    this.publisher = new RoomPublisher(
      sharedDb(env),
      `game:${ctx.id.name}`,
      null,
      () => gamePublished(this.logic.store, this.gameId),
      () => this.publishLater()
    )
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
    if (name === 'safety.showStop' && answer.ok && answer.value === true) {
      this.ctx.waitUntil(this.postStop())
    }
    if (name === 'downtime.begin' && answer.ok && answer.value === true) {
      this.countUsage('downtime:game')
    }
    if (answer.ok && !GAME_READ_ACTS.has(name)) {
      const result = answer.value as GameActResult<'submit'>
      if (name !== 'submit') this.broadcastSnapshots()
      else if (result.ok) {
        const ids = result.applied.map((op) => op.id)
        this.broadcast(appliedMessages(this.logic.store, ids, this.gameId))
        // A Downtime step is read back off its op (`downtime` record's `doneSteps`).
        if (ids.some(isDowntimeStepOp)) this.broadcastSnapshots()
        else {
          this.broadcast([{ type: 'record', table: 'crew', record: crewRecord(this.logic) }])
          this.published()
        }
      }
    }
    return answer
  }

  /** The Stop Sign to the bound channel, while it is still up and the table still opted in. */
  private async postStop(): Promise<void> {
    if (this.logic.safety.stillPosting()) await postStopSign(this.env as StopSignEnv, this.gameId)
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

  /**
   * End the Game (Organizer only): every unit goes to its holder's Training
   * Bay, the rest and the tray to the Organizer's, each member's room drops
   * the Game from its list, then the room is wiped.
   * A retry after a failed delivery delivers only what had not landed.
   */
  async disband(actor: string): Promise<GameActAnswer<null>> {
    const at = Date.now()
    const disbanded = answerOrRefuse(() => this.logic.roster.disband(actor, at))
    if (!disbanded.ok) return disbanded
    const ended = disbanded.value
    for (const { to, parcel } of ended.deliveries) {
      await accountHome(to).accept(parcel, to, at)
    }
    await accountHome(ended.tray.to).fileTray(`disband-tray:${this.gameId}`, ended.tray.npcs, at)
    for (const { userId } of this.logic.store.members()) {
      await accountHome(userId).leftGame(this.gameId)
    }
    await this.wipe()
    this.dropStrangers()
    return { ok: true, value: null }
  }

  /** A member deleted their account; a Game left with nobody is wiped. */
  async forget(userId: string): Promise<void> {
    if (this.logic.roster.forgetMember(userId).empty) await this.wipe()
    this.dropStrangers()
  }

  /**
   * After the roster lost someone (or everyone): every socket hears the room
   * as it now is, which for a non-member is empty, and a non-member's socket
   * is then closed for good (`ROOM_GONE`).
   */
  private dropStrangers(): void {
    this.broadcastSnapshots()
    closeGone(this.ctx, (member) => this.isMember(member))
  }

  private isMember(member: string): boolean {
    return this.logic.store.member(member) !== null
  }

  /**
   * A socket for a member the Worker let through: hibernatable, tagged with
   * who and whether it is a seat (here) or a watcher.
   */
  override async fetch(request: Request): Promise<Response> {
    const member = this.socketMember(request)
    if (member === null) return new Response(null, { status: 400 })
    const role = request.headers.get(SEAT_HEADER) === '1' ? SEAT_TAG : WATCH_TAG
    const socket = this.openSocket([member, role], gameSnapshot(this.logic, member, this.gameId))
    this.broadcastPresence()
    return socket
  }

  /**
   * A member's `ops` batch (applied all or none) or `act` (run as theirs),
   * answered on its socket; every socket hears what changed.
   */
  protected heard(ws: RoomSocket, member: string, said: ClientMessage): void {
    if (said.type === 'act') {
      const act = socketAct(said, GAME_SOCKET_ACTS)
      const answer =
        'refusal' in act
          ? { ok: false as const, refusal: act.refusal }
          : this.act(member, act.name, act.args as never)
      ws.send(JSON.stringify(actAnswer(said.id, answer)))
      return
    }
    const opIds = said.ops.map((op) => op.id)
    const answer = this.act(member, 'submit', {
      ops: said.ops,
      ...(said.replayed === true ? { replayed: true } : {}),
    })
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

  protected broadcastSnapshots(): void {
    snapshotEach(this.ctx, (member) => gameSnapshot(this.logic, member, this.gameId))
    this.published()
  }

  /** The same messages to every member's open socket. */
  private broadcast(messages: readonly ServerMessage[]): void {
    sendEach(this.ctx, messages, (member) => this.isMember(member))
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
