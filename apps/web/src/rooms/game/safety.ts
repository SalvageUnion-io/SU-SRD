import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'

/**
 * A Game's Safety Protocols (Core Book pp.12-13): the Stop Sign, with its
 * rules.
 *
 * - **The Stop Sign:** any member shows it, with no reason asked, and every
 *   screen shows the game is paused without saying who. Whoever showed it, or
 *   the table runner, lifts it.
 * - **Discord:** showing it posts the bot's fixed words to the Game's bound
 *   channel, at most once a minute; there is no opt-in, and unbinding the
 *   channel is how it stops. The room says when to post; the Durable Object
 *   posts (`../../worker/shared/stopSign.ts`).
 */

/** The least time between two Stop Sign posts to one Game's channel. */
const POST_EVERY_MS = 60_000

export type StopSignRead = {
  stop: { shownAt: number; mine: boolean } | null
  mayLift: boolean
}

type StopRow = {
  updatedAt: number
  shownBy: string | null
  shownAt: number | null
  postedAt: number | null
}

export class GameSafety {
  constructor(private readonly store: GameStore) {}

  /** The Stop Sign as a member's screen reads it, never saying who showed it; null for a non-member. */
  stopSign(actor: string): StopSignRead | null {
    const member = this.store.member(actor)
    if (member === null) return null
    const runner = this.store.isTableRunner(member)
    const row = this.row()
    const up = row.shownAt !== null
    const mine = up && row.shownBy === actor
    return {
      stop: up ? { shownAt: Number(row.shownAt), mine } : null,
      mayLift: up && (mine || runner),
    }
  }

  /**
   * Show the Stop Sign: the game is paused for everyone. Showing it while it
   * is up changes nothing. True when the room should post it to Discord now.
   */
  showStop(actor: string, at: number): boolean {
    return this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      const row = this.row()
      if (row.shownAt !== null) return false
      const post = row.postedAt === null || at - row.postedAt >= POST_EVERY_MS
      this.write({
        ...row,
        shownBy: actor,
        shownAt: at,
        postedAt: post ? at : row.postedAt,
        updatedAt: at,
      })
      return post
    })
  }

  /** Lift the Stop Sign and resume play: whoever showed it, or the table runner. */
  liftStop(actor: string, at: number): void {
    this.store.sql.transaction(() => {
      const member = this.store.requireMember(actor)
      const row = this.row()
      if (row.shownAt === null) return
      if (row.shownBy !== actor && !this.store.isTableRunner(member)) {
        throw new RoomRefusal('Only whoever showed the Stop Sign, or the Mediator, can lift it')
      }
      this.write({ ...row, shownBy: null, shownAt: null, updatedAt: at })
    })
  }

  /** Whether a post is still wanted: the sign is still up. */
  stillPosting(): boolean {
    return this.row().shownAt !== null
  }

  /** When the Stop Sign last changed; 0 before it was first touched. */
  updatedAt(): number {
    return this.row().updatedAt
  }

  private row(): StopRow {
    const row = this.store.rows('select * from stop_sign where id = 1')[0]
    if (row === undefined) {
      return { updatedAt: 0, shownBy: null, shownAt: null, postedAt: null }
    }
    return {
      updatedAt: Number(row.updated_at),
      shownBy: (row.shown_by as string | null) ?? null,
      shownAt: row.shown_at === null ? null : Number(row.shown_at),
      postedAt: row.posted_at === null ? null : Number(row.posted_at),
    }
  }

  private write(row: StopRow): void {
    this.store.rows(
      `insert into stop_sign (id, shown_by, shown_at, posted_at, updated_at)
       values (1, ?, ?, ?, ?)
       on conflict (id) do update set shown_by = excluded.shown_by, shown_at = excluded.shown_at,
         posted_at = excluded.posted_at, updated_at = excluded.updated_at`,
      row.shownBy,
      row.shownAt,
      row.postedAt,
      row.updatedAt
    )
  }
}
