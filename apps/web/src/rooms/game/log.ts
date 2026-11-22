import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'

/**
 * The table's Change Log, with its rules: Play's rolls and the Mediator's
 * alerts, feed rows on the Game that
 * change no unit (ADR-063 §7). Any member reads them; a member appends
 * their rolls, and only the Mediator sends an alert. A unit's change is its
 * op, so a row about a unit is not kept: its history is `units.history`.
 *
 * A roll logged `private` (ADR-051 §9a) is the Mediator's own: only a
 * Mediator and whoever rolled it read it back, until a Mediator reveals it
 * (`reveal`), after which it is the table's like any other roll.
 *
 * A roll logged `veiled` (ADR-051 §9b) is the Opposition's: the row keeps the
 * whole line, and the room serves a player the veiled line in its place (that
 * the Mediator rolled, and what it came to) until a Mediator reveals it
 * (`reveal`). The names never leave the room for a player's screen.
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
  /** Only a Mediator and its roller read it; absent on a roll the table reads. */
  private?: true
  /** A Mediator's copy of a roll the players read without its names; absent once revealed. */
  veiled?: true
}

/** A roll's row as its `after` keeps it. */
type StoredRoll = {
  description?: unknown
  private?: unknown
  /** The line a player reads in its place. */
  veiled?: unknown
  revealed?: unknown
}

/**
 * A roll's line as one reader is served it (ADR-051 §9b): a veiled roll reads
 * whole to a Mediator, marked, and as its veiled line to anyone else, until it
 * is revealed.
 */
export function rollLineFor(
  after: unknown,
  mediates: boolean
): { description: string; veiled?: true } {
  const roll = after as StoredRoll | null
  const whole = typeof roll?.description === 'string' ? roll.description : 'A roll'
  if (typeof roll?.veiled !== 'string' || roll.revealed === true) return { description: whole }
  return mediates ? { description: whole, veiled: true } : { description: roll.veiled }
}

/** Whether a roll's row is still kept from the players whole: private, and never revealed (r3 A1). */
export function isPrivateRoll(after: unknown): boolean {
  const roll = after as StoredRoll | null
  return roll?.private === true && roll.revealed !== true
}

/** Whether a Mediator showed the table this roll (`reveal`). */
export function isRevealedRoll(after: unknown): boolean {
  return (after as StoredRoll | null)?.revealed === true
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
      const { mediator } = this.store.requireMember(actor)
      for (const e of entries) {
        if (e.entityType !== 'game') continue
        this.put(e.field, mediator ? (e.after ?? null) : shared(e.after), e.source, actor, e.ts)
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

  /**
   * Take an alert back (r4 B4): its row goes, so it leaves every player's
   * strip and Feed, and the table's events say it was withdrawn
   * (`events.ts`). The Mediator's; to correct one, withdraw it and send again.
   */
  withdrawAlert(actor: string, alertId: string): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const found = this.store.rows(
        "select 1 from change_log where id = ? and field = 'alert'",
        alertId
      )
      if (found.length === 0) throw new RoomRefusal('That alert is no longer there')
      this.store.rows("delete from change_log where id = ? and field = 'alert'", alertId)
    })
  }

  /**
   * Show the table a roll whole (ADR-051 §9b): a veiled one with its names, a
   * private one at all (r3 A1). The Mediator's, and it stays shown.
   */
  reveal(actor: string, rollId: string): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const row = this.store.rows(
        "select after from change_log where id = ? and field = 'roll'",
        rollId
      )[0]
      const after = row === undefined ? null : (parsed(row.after) as StoredRoll | null)
      if (after === null || (typeof after.veiled !== 'string' && after.private !== true)) {
        throw new RoomRefusal('That is not a roll to reveal')
      }
      this.store.rows(
        'update change_log set after = ? where id = ?',
        JSON.stringify({ ...after, revealed: true }),
        rollId
      )
    })
  }

  /** The newest rolls, newest first, each named by its roller as the roster names them. */
  rolls(actor: string): RollRow[] {
    const mediates = this.store.member(actor)?.mediator === true
    return this.newest(actor, 'roll').flatMap((row): RollRow[] => {
      const after = parsed(row.after)
      const actorId = row.actor_id === null ? null : String(row.actor_id)
      const hidden = isPrivateRoll(after)
      if (hidden && !mediates && actorId !== actor) return []
      return [
        {
          _id: String(row.id),
          ts: Number(row.ts),
          source: String(row.source),
          ...rollLineFor(after, mediates),
          actorName:
            actorId === null ? null : (this.store.member(actorId)?.displayName ?? 'Crewmate'),
          ...(hidden ? { private: true as const } : {}),
        },
      ]
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

/** A row as the whole table reads it: only the Mediator's is ever private, or veiled. */
function shared(after: unknown): unknown {
  if (after === null || typeof after !== 'object') return after ?? null
  const {
    private: _private,
    veiled: _veiled,
    revealed: _revealed,
    ...rest
  } = after as Record<string, unknown>
  return rest
}

function parsed(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : null
}
