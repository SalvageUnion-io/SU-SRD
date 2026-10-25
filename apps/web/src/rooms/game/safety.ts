import type { BoundaryKind } from 'game-domain/games/safety'
import {
  BOUNDARIES_MAX,
  BOUNDARY_KINDS,
  boundaryRefusal,
  normalizeBoundary,
} from 'game-domain/games/safety'
import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'
import { bit } from './store'

/**
 * A Game's Safety Protocols (Core Book pp.12-13), with `convex/safety.ts`'s
 * rules.
 *
 * - **Boundaries:** the Out of Bounds and Off Camera lists, which every member
 *   reads and adds to. Nobody is named beside one; whoever added it, or the
 *   table runner, takes it off.
 * - **The Stop Sign:** any member shows it, with no reason asked, and every
 *   screen shows the game is paused without saying who. Whoever showed it, or
 *   the table runner, lifts it.
 * - **Discord:** with the table runner's opt-in, showing it posts the bot's
 *   fixed words to the Game's bound channel, at most once a minute. The room
 *   says when to post; the Durable Object posts (`../../worker/shared/stopSign.ts`).
 */

/** The least time between two Stop Sign posts to one Game's channel. */
const POST_EVERY_MS = 60_000

export type BoundaryRead = { id: string; kind: BoundaryKind; text: string; mayRemove: boolean }

export type StopSignRead = {
  stop: { shownAt: number; mine: boolean } | null
  mayLift: boolean
  /** The table runner may change the Discord opt-in. */
  mayManage: boolean
  postToChannel: boolean
}

type StopRow = {
  shownBy: string | null
  shownAt: number | null
  postToChannel: boolean
  postedAt: number | null
}

export class GameSafety {
  constructor(
    private readonly store: GameStore,
    private readonly newId: () => string
  ) {}

  /** The Game's boundaries, oldest first, each saying whether the caller may take it off. */
  boundaries(actor: string): BoundaryRead[] {
    const member = this.store.member(actor)
    if (member === null) return []
    const runner = this.store.isTableRunner(member)
    return this.store.rows('select * from boundaries order by added_at, id').map((row) => ({
      id: String(row.id),
      kind: row.kind as BoundaryKind,
      text: String(row.text),
      mayRemove: runner || row.added_by === actor,
    }))
  }

  /** Add one boundary to one of the lists: any member may. Answers its id. */
  addBoundary(actor: string, kind: BoundaryKind, text: string, at: number): string {
    return this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      if (!(BOUNDARY_KINDS as readonly string[]).includes(kind)) {
        throw new Error(`Not one of BOUNDARY_KINDS: ${kind}`)
      }
      const refused = boundaryRefusal(text)
      if (refused !== null) throw new RoomRefusal(refused)
      const [count] = this.store.rows('select count(*) as n from boundaries')
      if (Number(count?.n ?? 0) >= BOUNDARIES_MAX) {
        throw new RoomRefusal(`A Game keeps at most ${BOUNDARIES_MAX} boundaries.`)
      }
      const id = this.newId()
      this.store.rows(
        'insert into boundaries (id, kind, text, added_by, added_at) values (?, ?, ?, ?, ?)',
        id,
        kind,
        normalizeBoundary(text),
        actor,
        at
      )
      return id
    })
  }

  /** Take a boundary off: whoever added it, or the table runner. One already gone is not an error. */
  removeBoundary(actor: string, boundaryId: string): void {
    this.store.sql.transaction(() => {
      const member = this.store.requireMember(actor)
      const row = this.store.rows('select added_by from boundaries where id = ?', boundaryId)[0]
      if (row === undefined) return
      if (row.added_by !== actor && !this.store.isTableRunner(member)) {
        throw new RoomRefusal('Only whoever added a boundary, or the Mediator, can take it off')
      }
      this.store.rows('delete from boundaries where id = ?', boundaryId)
    })
  }

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
      this.write({ ...row, shownBy: actor, shownAt: at, postedAt: post ? at : row.postedAt })
      return post
    })
  }

  /** Lift the Stop Sign and resume play: whoever showed it, or the table runner. */
  liftStop(actor: string): void {
    this.store.sql.transaction(() => {
      const member = this.store.requireMember(actor)
      const row = this.row()
      if (row.shownAt === null) return
      if (row.shownBy !== actor && !this.store.isTableRunner(member)) {
        throw new RoomRefusal('Only whoever showed the Stop Sign, or the Mediator, can lift it')
      }
      this.write({ ...row, shownBy: null, shownAt: null })
    })
  }

  /** The table runner's opt-in: whether showing the Stop Sign posts to the bound channel. */
  setPostToChannel(actor: string, on: boolean): void {
    this.store.sql.transaction(() => {
      this.store.requireTableRunner(actor)
      this.write({ ...this.row(), postToChannel: on })
    })
  }

  /** Whether a post is still wanted: the sign is up and the table still opted in. */
  stillPosting(): boolean {
    const row = this.row()
    return row.postToChannel && row.shownAt !== null
  }

  private row(): StopRow {
    const row = this.store.rows('select * from stop_sign where id = 1')[0]
    if (row === undefined)
      return { shownBy: null, shownAt: null, postToChannel: false, postedAt: null }
    return {
      shownBy: (row.shown_by as string | null) ?? null,
      shownAt: row.shown_at === null ? null : Number(row.shown_at),
      postToChannel: row.post_to_channel === 1,
      postedAt: row.posted_at === null ? null : Number(row.posted_at),
    }
  }

  private write(row: StopRow): void {
    this.store.rows(
      `insert into stop_sign (id, shown_by, shown_at, post_to_channel, posted_at)
       values (1, ?, ?, ?, ?)
       on conflict (id) do update set shown_by = excluded.shown_by, shown_at = excluded.shown_at,
         post_to_channel = excluded.post_to_channel, posted_at = excluded.posted_at`,
      row.shownBy,
      row.shownAt,
      bit(row.postToChannel),
      row.postedAt
    )
  }
}
