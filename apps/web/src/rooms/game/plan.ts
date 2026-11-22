/**
 * A Game's plan (ADR-067 §4): its Mediator's notes and sessions, one row.
 * The table runner's alone (the Mediator, or the Organiser while nobody
 * mediates): nobody else reads or writes it, and it rides no socket.
 *
 * Its notes are their author's: a runner reads and writes only their own, so
 * handing the table over hands over the sessions and never a note. Whoever
 * wrote some can still read them back once the table is someone else's
 * (`readOwn`), and only them. Notes kept
 * before they had authors belong to whoever ran the table then (`settle`).
 */

import { hasMediator, runsTable } from 'game-domain/games/roles'
import type { GamePlan, OwnPlanNotes, StoredGamePlan } from 'game-domain/schemas/gamePlan'
import {
  EMPTY_GAME_PLAN,
  GamePlanSchema,
  ownNotesFor,
  planFor,
  planWith,
  StoredGamePlanSchema,
  sessionDaysFrom,
} from 'game-domain/schemas/gamePlan'
import type { GameStore } from './store'
import { fromJson } from './store'

export class GamePlanStore {
  constructor(private readonly store: GameStore) {}

  /** The actor's plan: the Game's sessions and their own notes; empty where none was written. */
  read(actor: string): GamePlan {
    this.store.requireTableRunner(actor)
    return planFor(this.stored(), actor)
  }

  /**
   * The notes a member wrote while they ran the table, to read once they no
   * longer do (MD4-17): their own and nobody else's, or null with none.
   */
  readOwn(actor: string): OwnPlanNotes | null {
    this.store.requireMember(actor)
    return ownNotesFor(this.stored(), actor)
  }

  /** Keep what the actor wrote: the sessions for the Game, the notes as theirs alone. */
  write(actor: string, plan: unknown, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireTableRunner(actor)
      this.keep(planWith(this.stored(), actor, GamePlanSchema.parse(plan)), at)
    })
  }

  /**
   * Before the table changes hands: notes kept before they had authors are
   * marked as whoever runs the table now, so the next runner never reads them.
   */
  settle(at: number): void {
    const stored = this.stored()
    if (
      stored.author !== undefined ||
      this.store.rows('select 1 from plan where id = 1').length === 0
    )
      return
    const members = this.store.members()
    const runner = members.find((member) => runsTable(member, hasMediator(members)))
    if (runner !== undefined) this.keep({ ...stored, author: runner.userId }, at)
  }

  /** The session days from `from` on, for any member: the days and nothing else. */
  sessionDays(from: string): string[] {
    return sessionDaysFrom(this.stored(), from)
  }

  private stored(): StoredGamePlan {
    const row = this.store.rows('select body from plan where id = 1')[0]
    if (row === undefined) return EMPTY_GAME_PLAN
    const parsed = StoredGamePlanSchema.safeParse(fromJson<unknown>(row.body))
    return parsed.success ? parsed.data : EMPTY_GAME_PLAN
  }

  private keep(plan: StoredGamePlan, at: number): void {
    this.store.rows(
      `insert into plan (id, body, updated_at) values (1, ?, ?)
       on conflict(id) do update set body = excluded.body, updated_at = excluded.updated_at`,
      JSON.stringify(plan),
      at
    )
  }
}
