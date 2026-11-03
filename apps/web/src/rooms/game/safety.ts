import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'
import { bit } from './store'

/**
 * A Game's Safety Protocols (Core Book pp.12-13): the Stop Sign, with its
 * rules.
 *
 * - **The Stop Sign:** any member shows it, with no reason asked, and every
 *   screen shows the game is paused without saying who. Whoever showed it, or
 *   the table runner, lifts it.
 * - **Discord:** with the table runner's opt-in, showing it posts the bot's
 *   fixed words to the Game's bound channel, at most once a minute. The room
 *   says when to post; the Durable Object posts (`../../worker/shared/stopSign.ts`).
 */

/** The least time between two Stop Sign posts to one Game's channel. */
const POST_EVERY_MS = 60_000

export type StopSignRead = {
  stop: { shownAt: number; mine: boolean } | null
  mayLift: boolean
  /** The table runner may change the Discord opt-in. */
  mayManage: boolean
  postToChannel: boolean
}

type StopRow = {
  updatedAt: number
  shownBy: string | null
  shownAt: number | null
  postToChannel: boolean
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
      mayManage: runner,
      postToChannel: row.postToChannel,
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
      const post =
        row.postToChannel && (row.postedAt === null || at - row.postedAt >= POST_EVERY_MS)
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

  /** The table runner's opt-in: whether showing the Stop Sign posts to the bound channel. */
  setPostToChannel(actor: string, on: boolean, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireTableRunner(actor)
      this.write({ ...this.row(), postToChannel: on, updatedAt: at })
    })
  }

  /** Whether a post is still wanted: the sign is up and the table still opted in. */
  stillPosting(): boolean {
    const row = this.row()
    return row.postToChannel && row.shownAt !== null
  }

  /** When the Stop Sign last changed; 0 before it was first touched. */
  updatedAt(): number {
    return this.row().updatedAt
  }

  private row(): StopRow {
    const row = this.store.rows('select * from stop_sign where id = 1')[0]
    if (row === undefined) {
      return { updatedAt: 0, shownBy: null, shownAt: null, postToChannel: false, postedAt: null }
    }
    return {
      updatedAt: Number(row.updated_at),
      shownBy: (row.shown_by as string | null) ?? null,
      shownAt: row.shown_at === null ? null : Number(row.shown_at),
      postToChannel: row.post_to_channel === 1,
      postedAt: row.posted_at === null ? null : Number(row.posted_at),
    }
  }

  private write(row: StopRow): void {
    this.store.rows(
      `insert into stop_sign (id, shown_by, shown_at, post_to_channel, posted_at, updated_at)
       values (1, ?, ?, ?, ?, ?)
       on conflict (id) do update set shown_by = excluded.shown_by, shown_at = excluded.shown_at,
         post_to_channel = excluded.post_to_channel, posted_at = excluded.posted_at,
         updated_at = excluded.updated_at`,
      row.shownBy,
      row.shownAt,
      bit(row.postToChannel),
      row.postedAt,
      row.updatedAt
    )
  }
}
