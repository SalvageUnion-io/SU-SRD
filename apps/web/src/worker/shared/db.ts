/**
 * The shared database: one D1 database, binding `SHARED` in
 * wrangler.jsonc, holding what crosses rooms. Its tables are
 * `apps/web/migrations/*.sql`; the deploy applies them before it ships.
 *
 * The rooms write it when a thing changes, through the writers beside this
 * file, and the Worker reads it. Typed as the slice of D1 these modules use,
 * so a test hands in `bun:sqlite` (`__tests__/d1.ts`) rather than workerd.
 */

/** One prepared statement, bound or not. */
export type SharedStatement = {
  bind(...values: unknown[]): SharedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

/** The slice of a D1 binding the shared modules use. */
export type SharedDb = {
  prepare(sql: string): SharedStatement
  /** Every statement in one transaction: all or none. */
  batch(statements: SharedStatement[]): Promise<unknown[]>
}

/** A JSON column, or null when it does not parse: a broken row reads as a missing one. */
export function parseJson<T>(text: unknown): T | null {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/** SQLite has no boolean: 0 and 1. */
export { bit as flag } from '../../rooms/game/store'

/**
 * Whether the cutover's copy has filled the shared database. Until it has,
 * a reader keeps its old source, so nothing reads an empty table: a missing
 * binding or a failed read counts as not filled.
 */
export async function isFilled(db: SharedDb | undefined): Promise<boolean> {
  if (db === undefined) return false
  try {
    const row = await db
      .prepare("select value from shared_meta where key = 'filled'")
      .first<{ value: string }>()
    return row !== null
  } catch {
    return false
  }
}

/** Mark the shared database filled: every reader moves to it. The cutover's last step. */
export async function markFilled(db: SharedDb, now = Date.now()) {
  await db
    .prepare(
      `insert into shared_meta (key, value) values ('filled', ?1)
       on conflict (key) do update set value = excluded.value`
    )
    .bind(String(now))
    .run()
}
