import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'

/**
 * The table's Change Log, with its rules: rolls (Play's
 * and the bot's) and the Mediator's alerts, feed rows on the Game that
 * change no unit (ADR-063 §7). Any member reads them; a member appends
 * their rolls, and only the Mediator sends an alert. A unit's change is its
 * op, so a row about a unit is not kept: its history is `units.history`.
 */

/** The most rows of each field a read returns: the feed's newest page. */
const FEED_ROWS = 100

/** A row a client appends, as `changeLog.appendChangeLog` takes it. */
export type LogEntry = {
  entityType: string
  field: string
  after?: unknown
  source: string
  ts: number
}

export type RollRow = {
  _id: string
  ts: number
  source: string
  description: string
  actorName: string | null
}

export type AlertRow = { _id: string; message: string; ts: number; actorId: string | null }

export class GameLog {
  constructor(
    private readonly store: GameStore,
    private readonly newId: () => string
  ) {}

  /** A member's rows about the table (their rolls); a row about a unit is its op, and not kept. */
  append(actor: string, entries: readonly LogEntry[]): void {
    if (entries.some((e) => e.field === 'alert')) {
      throw new RoomRefusal('Alerts are written by the Mediator, not by a client append')
    }
    this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      for (const e of entries) {
        if (e.entityType !== 'game') continue
        this.put(e.field, e.after ?? null, e.source, actor, e.ts)
      }
    })
  }

  /** A table-wide alert, the Mediator's. */
  broadcast(actor: string, message: string, at: number): void {
    const text = message.trim()
    if (text.length === 0) throw new RoomRefusal('An alert needs a message')
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.put('alert', text, 'mediator-alert', actor, at)
    })
  }

  /** The newest rolls, newest first, each named by its roller as the roster names them. */
  rolls(actor: string): RollRow[] {
    return this.newest(actor, 'roll').map((row) => {
      const after = parsed(row.after) as { description?: unknown } | null
      const actorId = row.actor_id === null ? null : String(row.actor_id)
      return {
        _id: String(row.id),
        ts: Number(row.ts),
        source: String(row.source),
        description: typeof after?.description === 'string' ? after.description : 'A roll',
        actorName:
          actorId === null ? null : (this.store.member(actorId)?.displayName ?? 'Crewmate'),
      }
    })
  }

  /** The newest alerts, newest first. */
  alerts(actor: string): AlertRow[] {
    return this.newest(actor, 'alert').map((row) => ({
      _id: String(row.id),
      message: String(parsed(row.after)),
      ts: Number(row.ts),
      actorId: row.actor_id === null ? null : String(row.actor_id),
    }))
  }

  private newest(actor: string, field: string) {
    if (this.store.member(actor) === null) return []
    return this.store.rows(
      'select * from change_log where field = ? order by ts desc, id limit ?',
      field,
      FEED_ROWS
    )
  }

  private put(field: string, after: unknown, source: string, actor: string, ts: number): void {
    this.store.rows(
      'insert into change_log (id, field, after, source, actor_id, ts) values (?, ?, ?, ?, ?, ?)',
      this.newId(),
      field,
      JSON.stringify(after),
      source,
      actor,
      ts
    )
  }
}

function parsed(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : null
}
