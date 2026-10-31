import type { GameStore } from './store'

/**
 * The Game's group session (play.md §10): the table runner, the Mediator or
 * the Organiser while nobody mediates, starts it when the table sits down and
 * ends it when they get up. Every member reads whether one is running, so the
 * Play hub and the Game's page can say "Session live" and offer Join.
 *
 * A session gates nothing: a player may open Play at any time, and the
 * Mediator's screen opens with or without one. It is the table's shared
 * signal that play has begun, never a lock. Who started it stays in the room.
 */

export type SessionRead = { live: boolean; startedAt: number | null }

const NOT_LIVE: SessionRead = { live: false, startedAt: null }

export class GameSession {
  constructor(private readonly store: GameStore) {}

  /** Whether a session is running, for a member; not live for anyone else. */
  session(actor: string): SessionRead {
    if (this.store.member(actor) === null) return NOT_LIVE
    const startedAt = this.startedAt()
    return startedAt === null ? NOT_LIVE : { live: true, startedAt }
  }

  /** Start the group session; true when this started one, false when one was already live. */
  start(actor: string, at: number): boolean {
    return this.store.sql.transaction(() => {
      this.store.requireTableRunner(actor)
      if (this.startedAt() !== null) return false
      this.store.rows(
        'insert into session (id, started_at, started_by) values (1, ?, ?)',
        at,
        actor
      )
      return true
    })
  }

  /** End the group session. None running is not an error. */
  end(actor: string): void {
    this.store.sql.transaction(() => {
      this.store.requireTableRunner(actor)
      this.store.rows('delete from session where id = 1')
    })
  }

  private startedAt(): number | null {
    const row = this.store.rows('select started_at from session where id = 1')[0]
    return row === undefined ? null : Number(row.started_at)
  }
}
