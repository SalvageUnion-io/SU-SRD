import type { ApplyOp } from '../ops'
import type { RoomSql } from '../sql'
import type { TableEvent } from './events'
import { GameEvents } from './events'
import { GameLog } from './log'
import { GameOpposition } from './opposition'
import { GamePlanStore } from './plan'
import { GamePlay } from './play'
import { GameProposals } from './proposals'
import { GameRoster, randomInviteCode } from './roster'
import { GameSafety } from './safety'
import { GameScene } from './scene'
import { GameSession, SESSION_ENDS_IDLE_MS } from './session'
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
  readonly safety: GameSafety
  readonly session: GameSession
  readonly plan: GamePlanStore
  readonly log: GameLog
  readonly events: GameEvents
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
    this.plan = new GamePlanStore(store)
    this.roster = new GameRoster(store, this.units, deps.mintCode ?? randomInviteCode, (from) =>
      this.plan.sessionDays(from)
    )
    this.play = new GamePlay(store, this.units, newId)
    this.opposition = new GameOpposition(store, newId)
    this.transit = new GameTransit(store, this.units, this.play)
    this.scene = new GameScene(store, this.units)
    this.safety = new GameSafety(store)
    this.session = new GameSession(store)
    this.log = new GameLog(store, newId)
    this.events = new GameEvents(store, newId)
  }

  /**
   * A group session nobody played in for `SESSION_ENDS_IDLE_MS` ends, as
   * End group session ends one (r8 B12): at the moment it ran out, with the
   * plan it played marked, and a line for the table, which this answers.
   * The room calls it before each act, so Home stops saying Session live.
   */
  endIdleSession(at: number): TableEvent[] {
    const last = this.session.lastPlayed()
    if (SESSION_ENDS_IDLE_MS === null || last === null || at - last < SESSION_ENDS_IDLE_MS)
      return []
    const ended = last + SESSION_ENDS_IDLE_MS
    this.store.sql.transaction(() => {
      this.session.endIdle()
      this.scene.clearUpNow(ended)
      this.opposition.endInitiative(ended)
      this.play.closeUnapplied(null, ended)
      this.plan.markPlayed(new Date(last).toISOString().slice(0, 10), ended)
    })
    return [this.events.endedIdle(ended)]
  }
}
