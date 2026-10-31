import type { ApplyOp } from '../ops'
import type { RoomSql } from '../sql'
import { GameLedger } from './ledger'
import { GameLog } from './log'
import { GameOpposition } from './opposition'
import { GamePlay } from './play'
import { GameProposals } from './proposals'
import { GameRoster, randomInviteCode } from './roster'
import { GameSafety } from './safety'
import { GameScene } from './scene'
import { GameSession } from './session'
import { GameStore } from './store'
import { GameTransit } from './transit'
import { GameUnits } from './units'

/**
 * One Game's room, as plain logic over its SQL: what the `GameRoom`
 * Durable Object serves (`../../worker/rooms.ts`).
 */
export class GameRoomLogic {
  readonly store: GameStore
  readonly roster: GameRoster
  readonly units: GameUnits
  readonly proposals: GameProposals
  readonly play: GamePlay
  readonly opposition: GameOpposition
  readonly transit: GameTransit
  readonly scene: GameScene
  readonly ledger: GameLedger
  readonly safety: GameSafety
  readonly session: GameSession
  readonly log: GameLog
  /** Mints an id for what the room makes (a proposal's op). */
  readonly newId: () => string

  constructor(
    sql: RoomSql,
    deps: { applyOp: ApplyOp; newId?: () => string; mintCode?: () => string }
  ) {
    const store = new GameStore(sql)
    this.store = store
    const newId = deps.newId ?? (() => crypto.randomUUID())
    this.newId = newId
    this.units = new GameUnits(store, deps.applyOp, newId)
    this.proposals = new GameProposals(store, this.units)
    this.roster = new GameRoster(store, this.units, deps.mintCode ?? randomInviteCode)
    this.play = new GamePlay(store, this.units, newId)
    this.opposition = new GameOpposition(store, newId)
    this.transit = new GameTransit(store, this.units, this.play)
    this.scene = new GameScene(store, this.units)
    this.ledger = new GameLedger(store, this.units, this.play, newId)
    this.safety = new GameSafety(store, newId)
    this.session = new GameSession(store)
    this.log = new GameLog(store, newId)
  }
}
