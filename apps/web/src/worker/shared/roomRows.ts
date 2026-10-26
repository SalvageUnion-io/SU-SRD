import type { Published, PublishedPattern, PublishedSheet } from '../../rooms/publish'
import type { SharedDb, SharedStatement } from './db'

/** The shared database a Worker's or room's `env` binds as `SHARED`, if it does. */
export function sharedDb(env: unknown): SharedDb | undefined {
  return (env as { SHARED?: SharedDb }).SHARED
}

/**
 * A room's rows in the shared database, kept in step with the room
 * (`../../rooms/publish.ts`): after every change the room asks again, and its
 * whole set is written in one batch, so a share, an edit and an unshare all
 * land the same way. The cutover's runner asks once per room after import.
 *
 * - **One write at a time.** A change while a write is out queues one more
 *   write, of whatever is true by then.
 * - **Nothing to say twice.** A room that published nothing, and still
 *   publishes nothing, writes nothing.
 * - **Only its own.** A room deletes the public sheets it wrote (`room`) and
 *   no longer holds, so a unit that moved keeps the row its new room wrote;
 *   a maker's Homebrew listings are their account room's alone.
 *
 * The rows are `apps/web/migrations`'s; the readers are this folder's.
 */
export class RoomPublisher {
  private writing: Promise<void> | null = null
  private again = false
  private wroteNone = false

  constructor(
    private readonly db: SharedDb | undefined,
    /** `account:<discord id>` or `game:<game id>`: the rows' `room`. */
    private readonly room: string,
    /** The Shelf's player, whose Homebrew listings these are; none for a Game. */
    private readonly maker: string | null,
    private readonly rowsOf: () => Published
  ) {}

  /** After a change: write the room's rows, now or after the write that is out. */
  changed(): Promise<void> {
    if (this.writing !== null) {
      this.again = true
      return this.writing
    }
    this.writing = this.drain().finally(() => {
      this.writing = null
    })
    return this.writing
  }

  /** Write the room's rows now, whatever was written before; the counts written. */
  async republish(): Promise<{ sheets: number; homebrew: number }> {
    this.wroteNone = false
    const rows = this.rowsOf()
    await this.write(rows)
    return { sheets: rows.sheets.length, homebrew: rows.homebrew.length }
  }

  private async drain(): Promise<void> {
    do {
      this.again = false
      try {
        await this.write(this.rowsOf())
      } catch (error) {
        console.error('publishing a room failed', this.room, error)
      }
    } while (this.again)
  }

  private async write(rows: Published): Promise<void> {
    const db = this.db
    if (db === undefined) return
    const none = rows.sheets.length === 0 && rows.homebrew.length === 0
    if (none && this.wroteNone) return
    await db.batch([
      ...sheetStatements(db, this.room, rows.sheets, Date.now()),
      ...(this.maker === null ? [] : homebrewStatements(db, this.maker, rows.homebrew)),
    ])
    this.wroteNone = none
  }
}

/** Every public sheet the room holds written, tagged with the room; every other it wrote, deleted. */
function sheetStatements(
  db: SharedDb,
  room: string,
  rows: readonly PublishedSheet[],
  now: number
): SharedStatement[] {
  const upsert = db.prepare(
    `insert into public_sheets (kind, app_id, owner_id, page, preview, created_at, updated_at, room)
     values (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)
     on conflict (kind, app_id) do update set
       owner_id = excluded.owner_id, page = excluded.page, preview = excluded.preview,
       updated_at = excluded.updated_at, room = excluded.room`
  )
  const held = JSON.stringify(rows.map((row) => `${row.kind}:${row.appId}`))
  return [
    ...rows.map((row) =>
      upsert.bind(
        row.kind,
        row.appId,
        row.ownerId,
        JSON.stringify(row.page),
        JSON.stringify(row.preview),
        now,
        room
      )
    ),
    db
      .prepare(
        `delete from public_sheets where room = ?1
         and kind || ':' || app_id not in (select value from json_each(?2))`
      )
      .bind(room, held),
  ]
}

/** Every pattern the maker lists written; every other they listed, deleted. Its moderation stays. */
function homebrewStatements(
  db: SharedDb,
  maker: string,
  rows: readonly PublishedPattern[]
): SharedStatement[] {
  const upsert = db.prepare(
    `insert into homebrew_patterns (app_id, owner_id, chassis_ref, name, body, made_by, shared_at)
     values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     on conflict (app_id) do update set
       owner_id = excluded.owner_id, chassis_ref = excluded.chassis_ref, name = excluded.name,
       body = excluded.body, made_by = excluded.made_by, shared_at = excluded.shared_at`
  )
  const held = JSON.stringify(rows.map((row) => row.appId))
  return [
    ...rows.map((row) =>
      upsert.bind(
        row.appId,
        row.ownerId,
        row.chassisRef,
        row.name,
        JSON.stringify(row.body),
        row.madeBy,
        row.sharedAt
      )
    ),
    db
      .prepare(
        `delete from homebrew_patterns where owner_id = ?1
         and app_id not in (select value from json_each(?2))`
      )
      .bind(maker, held),
  ]
}
