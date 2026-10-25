/**
 * The replica: the one place the client holds rows from the server.
 *
 * Every row a screen reads is here: the account's units, links, patterns, the
 * NPC tray and encounters, and the crawlers of the caller's Games. Rows arrive
 * from a feed (`feed.ts`): today the Convex subscriptions, from the cutover
 * the account and Game room sockets (`rooms/protocol.ts`). Each is kept on the
 * device (`persist.ts`), so a reload offline shows what the last one did.
 *
 * ## Scopes, and why absence is safe
 *
 * A feed speaks for one **scope** at a time, and its snapshot is the whole of
 * that scope: `account` is what the caller owns (a room's account snapshot,
 * Convex `listMine`), `wiring` the links and Game crawlers the caller sees.
 * A row is held while at least one scope holds it, so a snapshot that leaves a
 * row out takes that scope's claim away and nothing else's: a Game crawler the
 * caller also owns stays while either answer has it. That is the whole of the
 * old prune guard. A row this tab wrote joins the scope the server will serve
 * it in (`scopeOfWrite`), so the next snapshot either confirms it or, when
 * the write was undone elsewhere, drops it.
 *
 * ## Server wins
 *
 * A served row is adopted when this tab does not hold it or holds an older
 * version (its `headSeq`, else its row stamp): newer, not merely different, so
 * an answer older than a write this tab made is never adopted over it.
 *
 * Framework-free: React reads it through `hooks.ts`.
 */

import { containerOf } from 'game-domain/container'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { captureException } from '../lib/observability'
import type { RecordKind } from './records'
import { RECORD_KINDS } from './records'

export type Table = keyof typeof RECORD_KINDS

/** A table's row type, from its schema. */
export type RowOf<T extends Table> =
  (typeof RECORD_KINDS)[T] extends RecordKind<infer R> ? R : never

export const TABLES = Object.keys(RECORD_KINDS) as Table[]

/** Whose answer holds a row: see the header. */
export type Scope = 'account' | 'wiring'

type Held = {
  row: { id: string }
  /** The server's version when served; undefined for a row this tab wrote and nothing served yet. */
  version: number | undefined
  /** The unit's `headSeq` (ADR-063), when the server sent one. */
  headSeq: number | undefined
  scopes: ReadonlySet<Scope>
}

/** One served row: the body and its version. */
export type Served<T extends Table = Table> = {
  table: T
  row: unknown
  version: number
  headSeq?: number
}

/** A table's key in the view: its collection name, `pilots`, `softLinks`, … */
export type NameOf<T extends Table> = (typeof RECORD_KINDS)[T]['name']

/** The table of each collection name. */
export const TABLE_OF_NAME = Object.fromEntries(
  Object.entries(RECORD_KINDS).map(([t, k]) => [k.name, t])
) as { [T in Table as NameOf<T>]: T }

/** What a screen reads: each table's rows, newest first, and whether they have arrived. */
export type ReplicaView = { readonly [T in Table as NameOf<T>]: readonly RowOf<T>[] } & {
  readonly hydrated: { readonly [T in Table as NameOf<T>]: boolean }
}

const held = new Map<Table, Map<string, Held>>(TABLES.map((t) => [t, new Map()]))
let arrived = Object.fromEntries(TABLES.map((t) => [t, false])) as Record<Table, boolean>
let view: ReplicaView | null = null
/** Each table's rows as last read, rebuilt only when one of its rows changed. */
const tableViews = new Map<Table, readonly unknown[]>()
const listeners = new Set<() => void>()
const changeListeners = new Set<(changes: readonly Change[]) => void>()

/** One row put or dropped, for persistence. */
export type Change =
  | { kind: 'put'; table: Table; id: string; held: Held }
  | { kind: 'drop'; table: Table; id: string }

let pending: Change[] = []

function tableOf(t: Table): Map<string, Held> {
  return held.get(t) as Map<string, Held>
}

function changed(change: Change): void {
  pending.push(change)
}

/** Publish what changed: one render and one save per batch of changes. */
function commit(): void {
  if (pending.length === 0) return
  const changes = pending
  pending = []
  view = null
  for (const listener of [...listeners]) listener()
  for (const listener of [...changeListeners]) listener(changes)
}

function put(table: Table, id: string, next: Held): void {
  tableOf(table).set(id, next)
  tableViews.delete(table)
  changed({ kind: 'put', table, id, held: next })
}

function remove(table: Table, id: string): void {
  if (!tableOf(table).delete(id)) return
  tableViews.delete(table)
  changed({ kind: 'drop', table, id })
  // An entity's links go with it: a link to a row this tab no longer holds
  // would draw as a broken cross-link.
  if (table === 'softLink') return
  for (const [linkId, link] of tableOf('softLink')) {
    const l = link.row as SoftLink
    if (l.from?.id === id || l.to?.id === id) {
      tableOf('softLink').delete(linkId)
      tableViews.delete('softLink')
      changed({ kind: 'drop', table: 'softLink', id: linkId })
    }
  }
}

function parse<T extends Table>(table: T, row: unknown): RowOf<T> | null {
  const result = RECORD_KINDS[table].schema.safeParse(row)
  if (result.success) return result.data as RowOf<T>
  // A body the server holds that this build cannot read is a real schema
  // disagreement worth reporting; the rest of the answer still arrives.
  captureException(
    new Error(`[replica] Cannot hold a row of "${table}": it does not parse`, {
      cause: result.error,
    })
  )
  return null
}

function newer(served: Served, current: Held | undefined): boolean {
  if (current === undefined || current.version === undefined) return true
  if (served.headSeq !== undefined && current.headSeq !== undefined) {
    return served.headSeq > current.headSeq
  }
  return served.version > current.version
}

/**
 * A scope's snapshot of `tables`: adopt every served row that is newer than
 * the one held, then take this scope's claim off every row of those tables
 * the answer left out, dropping a row no scope still claims.
 */
export function serve(scope: Scope, tables: readonly Table[], served: readonly Served[]): void {
  const seen = new Map<Table, Set<string>>(tables.map((t) => [t, new Set()]))
  for (const s of served) {
    const id = (s.row as { id?: unknown } | null)?.id
    if (typeof id !== 'string') continue
    seen.get(s.table)?.add(id)
    const current = tableOf(s.table).get(id)
    const scopes = new Set(current?.scopes)
    scopes.add(scope)
    if (!newer(s, current)) {
      if (current !== undefined && !current.scopes.has(scope))
        put(s.table, id, { ...current, scopes })
      continue
    }
    const row = parse(s.table, s.row)
    // Unreadable: keep what is held, still claimed, rather than drop it.
    if (row === null) {
      if (current !== undefined) put(s.table, id, { ...current, scopes })
      continue
    }
    put(s.table, id, { row, version: s.version, headSeq: s.headSeq, scopes })
  }
  for (const table of tables) {
    const ids = seen.get(table) as Set<string>
    for (const [id, current] of [...tableOf(table)]) {
      if (ids.has(id) || !current.scopes.has(scope)) continue
      const scopes = new Set(current.scopes)
      scopes.delete(scope)
      if (scopes.size === 0) remove(table, id)
      else put(table, id, { ...current, scopes })
    }
  }
  arrived = { ...arrived, ...Object.fromEntries(tables.map((t) => [t, true])) }
  view = null
  commit()
  for (const listener of [...listeners]) listener()
  notifyArrival()
}

/** The scope the server will serve a written row in. */
function scopeOfWrite(table: Table, row: { id: string }): Scope {
  if (table === 'softLink') return 'wiring'
  if (table === 'crawler' && containerOf(row as never).kind === 'game') return 'wiring'
  return 'account'
}

/**
 * Hold a row the server accepted (a write's result) or sent on its own (a
 * delta): it replaces the held copy, keeping the scopes that claim it.
 */
export function hold<T extends Table>(
  table: T,
  row: RowOf<T>,
  version?: { version?: number; headSeq?: number }
): RowOf<T> {
  const id = (row as { id: string }).id
  const current = tableOf(table).get(id)
  const scopes = new Set(current?.scopes)
  scopes.add(scopeOfWrite(table, row as { id: string }))
  put(table, id, {
    row: row as { id: string },
    version: version?.version,
    headSeq: version?.headSeq ?? current?.headSeq,
    scopes,
  })
  commit()
  return row
}

/** Hold several rows and drop others as one change: a transfer's result. */
export function holdAll(
  puts: ReadonlyArray<{ table: Table; row: { id: string }; version?: number; headSeq?: number }>,
  drops: ReadonlyArray<{ table: Table; id: string }>
): void {
  for (const p of puts) {
    const current = tableOf(p.table).get(p.row.id)
    const scopes = new Set(current?.scopes)
    scopes.add(scopeOfWrite(p.table, p.row))
    put(p.table, p.row.id, {
      row: p.row,
      version: p.version,
      headSeq: p.headSeq ?? current?.headSeq,
      scopes,
    })
  }
  for (const d of drops) remove(d.table, d.id)
  commit()
}

/**
 * Put back the rows the device kept (`persist.ts`), under the scopes that
 * held them. A row already held came from a live answer, which is newer and
 * stays. Not a change to save: it is what was saved.
 */
export function restore(
  rows: ReadonlyArray<{
    table: Table
    id: string
    row: { id: string }
    version: number | undefined
    headSeq: number | undefined
    scopes: readonly Scope[]
  }>
): void {
  let any = false
  for (const r of rows) {
    const table = held.get(r.table)
    if (table === undefined || table.has(r.id)) continue
    tableViews.delete(r.table)
    table.set(r.id, {
      row: r.row,
      version: r.version,
      headSeq: r.headSeq,
      scopes: new Set(r.scopes),
    })
    any = true
  }
  if (!any) return
  view = null
  for (const listener of [...listeners]) listener()
}

/** Drop this tab's copy of a row (and an entity's links), never a server delete. */
export function drop(table: Table, id: string): void {
  remove(table, id)
  commit()
}

/** Drop several rows as one change. */
export function dropAll(rows: ReadonlyArray<{ table: Table; id: string }>): void {
  for (const r of rows) remove(r.table, r.id)
  commit()
}

/** The held row, or null. */
export function row<T extends Table>(table: T, id: string): RowOf<T> | null {
  return (tableOf(table).get(id)?.row as RowOf<T> | undefined) ?? null
}

/** The unit's `headSeq` as last served, for an op's `baseSeq` (ADR-063). */
export function headSeqOf(table: Table, id: string): number | undefined {
  return tableOf(table).get(id)?.headSeq
}

/** The server version of the held row, when one was served. */
export function versionOf(table: Table, id: string): number | undefined {
  return tableOf(table).get(id)?.version
}

/** Every table's rows as one immutable view, rebuilt only after a change. */
export function getView(): ReplicaView {
  if (view === null) {
    const tables = Object.fromEntries(
      TABLES.map((t) => {
        let rows = tableViews.get(t)
        if (rows === undefined) {
          rows = [...tableOf(t).values()].map((h) => h.row).reverse()
          tableViews.set(t, rows)
        }
        return [RECORD_KINDS[t].name, rows]
      })
    )
    const hydrated = Object.fromEntries(TABLES.map((t) => [RECORD_KINDS[t].name, arrived[t]]))
    view = { ...tables, hydrated } as unknown as ReplicaView
  }
  return view
}

/** Hear every change. Returns the unsubscribe. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hear each batch of row changes, for persistence. Returns the unsubscribe. */
export function onChanges(listener: (changes: readonly Change[]) => void): () => void {
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

// ── Arrival ─────────────────────────────────────────────────────────────

let rowsComing: () => boolean = () => false
const arrivalListeners = new Set<() => void>()

function notifyArrival(): void {
  for (const listener of [...arrivalListeners]) listener()
}

/**
 * Tell the replica whether rows may still be on their way (`sync.ts`): a
 * session still settling, a feed waiting on its first answer, a device read
 * still running. `untilArrived` waits only while it says so.
 */
export function setRowsComing(coming: () => boolean): void {
  rowsComing = coming
  notifyArrival()
}

/** Re-check the waiters: what `setRowsComing` reads has changed. */
export function rowsComingChanged(): void {
  notifyArrival()
}

/** Mark tables arrived without a snapshot: the device's copy was read. */
export function markArrived(tables: readonly Table[]): void {
  const fresh = tables.filter((t) => !arrived[t])
  if (fresh.length === 0) return
  arrived = { ...arrived, ...Object.fromEntries(fresh.map((t) => [t, true])) }
  view = null
  for (const listener of [...listeners]) listener()
  notifyArrival()
}

/** Resolve once `table`'s rows have arrived, or none are coming. */
export function untilArrived(table: Table): Promise<void> {
  return new Promise((resolve) => {
    const check = (): void => {
      if (!arrived[table] && rowsComing()) return
      arrivalListeners.delete(check)
      resolve()
    }
    arrivalListeners.add(check)
    check()
  })
}

/**
 * Forget every row: the session ended, so the next account on this device
 * starts empty. Every table reads as arrived, which is what signed out is.
 */
export function clear(): void {
  for (const table of TABLES) {
    for (const id of [...tableOf(table).keys()]) remove(table, id)
  }
  arrived = Object.fromEntries(TABLES.map((t) => [t, true])) as Record<Table, boolean>
  view = null
  commit()
  for (const listener of [...listeners]) listener()
  notifyArrival()
}

/**
 * Replace a table's rows and arrival as given, unparsed and sent nowhere: a
 * test's seed (`useUnits.setState`), the old stores' `setState`.
 */
export function setRows(
  table: Table,
  rows: readonly { id: string }[] | undefined,
  hasArrived?: boolean
): void {
  if (rows !== undefined) {
    const map = tableOf(table)
    for (const id of [...map.keys()]) {
      map.delete(id)
      changed({ kind: 'drop', table, id })
    }
    for (const r of [...rows].reverse()) {
      put(table, r.id, {
        row: r,
        version: undefined,
        headSeq: undefined,
        scopes: new Set(['account']),
      })
    }
    tableViews.delete(table)
  }
  if (hasArrived !== undefined) arrived = { ...arrived, [table]: hasArrived }
  view = null
  commit()
  for (const listener of [...listeners]) listener()
  notifyArrival()
}

/** A unit test's reset: empty, nothing arrived. */
export function resetReplica(): void {
  for (const table of TABLES) tableOf(table).clear()
  tableViews.clear()
  arrived = Object.fromEntries(TABLES.map((t) => [t, false])) as Record<Table, boolean>
  pending = []
  view = null
  rowsComing = () => false
  for (const listener of [...listeners]) listener()
}
