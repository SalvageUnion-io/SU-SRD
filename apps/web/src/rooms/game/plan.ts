/**
 * A Game's plan (ADR-067 §4): its Mediator's notes and sessions, one row.
 * The table runner's alone (the Mediator, or the Organiser while nobody
 * mediates): nobody else reads or writes it, and it rides no socket.
 */

import type { GamePlan } from 'game-domain/schemas/gamePlan'
import { EMPTY_GAME_PLAN, GamePlanSchema } from 'game-domain/schemas/gamePlan'
import type { GameStore } from './store'
import { fromJson } from './store'

export class GamePlanStore {
  constructor(private readonly store: GameStore) {}

  /** The plan, or an empty one where none was written (or it no longer reads). */
  read(actor: string): GamePlan {
    this.store.requireTableRunner(actor)
    const row = this.store.rows('select body from plan where id = 1')[0]
    if (row === undefined) return EMPTY_GAME_PLAN
    const parsed = GamePlanSchema.safeParse(fromJson<unknown>(row.body))
    return parsed.success ? parsed.data : EMPTY_GAME_PLAN
  }

  /** Replace the plan with what the Mediator wrote. */
  write(actor: string, plan: unknown, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireTableRunner(actor)
      const body = JSON.stringify(GamePlanSchema.parse(plan))
      this.store.rows(
        `insert into plan (id, body, updated_at) values (1, ?, ?)
         on conflict(id) do update set body = excluded.body, updated_at = excluded.updated_at`,
        body,
        at
      )
    })
  }
}
