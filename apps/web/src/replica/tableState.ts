/**
 * What a table plays under, as its room serves it (`rooms/protocol.ts`): the
 * Scene, the area being salvaged, the ledger, the boundaries and the Stop
 * Sign; the table in play: the roster, the seats, the Downtime, the
 * proposals, the rolls and alerts and the crew's vitals; for its Mediator only, the
 * Opposition tray and the encounter being run; and, from the account room, who
 * may read each saved pattern. Each record is per reader (who showed the Stop Sign never leaves the
 * room) and only means anything live, so it is held in memory per room scope
 * rather than in the replica's tables: a reload starts from the room's next
 * snapshot, and offline a screen shows none of it, as it did on Convex.
 *
 * A room serves each as the Convex query of the same name answered it, so
 * `useTable.ts` reads it here in that query's place. Framework-free.
 */

import type { RecordTable } from '../rooms/protocol'
import type { Scope } from './replica'

const STATE_TABLES = [
  'scene',
  'salvageArea',
  'ledger',
  'boundaries',
  'safety',
  'opposition',
  'mediator',
  'members',
  'seats',
  'downtime',
  'proposals',
  'sentProposals',
  'rolls',
  'alerts',
  'crew',
  'sharing',
] as const
export type StateTable = (typeof STATE_TABLES)[number]

/** The tables a query answered with one row (or null); every other answered a list. */
const ONE_ROW: ReadonlySet<StateTable> = new Set([
  'scene',
  'salvageArea',
  'ledger',
  'safety',
  'downtime',
  'mediator',
  'crew',
])

type Body = Record<string, unknown>
type StateRecord = { appId: string; body: Body }

/** Each room scope's state tables, once its first snapshot came: each record by its app id. */
const held = new Map<Scope, Map<StateTable, Map<string, Body>>>()
const listeners = new Set<() => void>()
const answers = new Map<string, unknown>()

function changed(): void {
  answers.clear()
  for (const listener of listeners) listener()
}

export function isStateTable(table: RecordTable): table is StateTable {
  return (STATE_TABLES as readonly string[]).includes(table)
}

/** A snapshot: the scope's state tables, whole. */
export function serveTableState(
  scope: Scope,
  records: Partial<Record<RecordTable, readonly StateRecord[]>>
): void {
  const tables = new Map<StateTable, Map<string, Body>>()
  for (const table of STATE_TABLES) {
    tables.set(table, new Map((records[table] ?? []).map((r) => [r.appId, r.body])))
  }
  held.set(scope, tables)
  changed()
}

/** One record, new or changed; before the scope's snapshot it waits for that. */
export function putTableState(scope: Scope, table: StateTable, record: StateRecord): void {
  const rows = held.get(scope)?.get(table)
  if (rows === undefined) return
  rows.set(record.appId, record.body)
  changed()
}

export function dropTableState(scope: Scope, table: StateTable, appId: string): void {
  if (held.get(scope)?.get(table)?.delete(appId) === true) changed()
}

/** A room's scope the player has left, or every scope at sign-out. */
export function forgetTableState(scope?: Scope): void {
  if (scope === undefined) held.clear()
  else held.delete(scope)
  changed()
}

/**
 * The table as its Convex query answered: undefined before the scope's
 * snapshot, then the one record or null, or every record (a boundary with
 * its id as `_id`; the Opposition, `{ _id, body }` per NPC as
 * `mediator.npcs` answered; sharing, each pattern's with its id as `appId`).
 * Stable between changes, for `useSyncExternalStore`.
 */
export function readTableState(scope: Scope, table: StateTable): unknown {
  const key = `${scope}\u0000${table}`
  if (answers.has(key)) return answers.get(key)
  const rows = held.get(scope)?.get(table)
  const answer =
    rows === undefined
      ? undefined
      : ONE_ROW.has(table)
        ? ([...rows.values()][0] ?? null)
        : [...rows].map(([id, body]) =>
            table === 'boundaries'
              ? { ...body, _id: id }
              : table === 'opposition'
                ? { _id: id, body }
                : table === 'sharing'
                  ? { ...body, appId: id }
                  : body
          )
  answers.set(key, answer)
  return answer
}

export function subscribeTableState(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
