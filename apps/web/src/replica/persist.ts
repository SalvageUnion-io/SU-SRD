/**
 * The replica on the device: every held row, in IndexedDB, so a reload with
 * no network shows what the last load held (it replaces ADR-058's device
 * copy, which saved the last two answers whole).
 *
 * One database, stamped with the account whose session is on the device; a
 * copy stamped for another account is dropped unread. Each batch of changes
 * (`onChanges`) is written in order, one transaction per batch. Where
 * IndexedDB is missing or refuses (a private window, a test runner) nothing is
 * kept and a reload offline starts empty.
 */

import { localStore } from '../lib/safeLocalStorage'
import type { Change, Scope, Table } from './replica'
import { onChanges, restore } from './replica'

/** One row as kept on the device. */
export type KeptRow = {
  table: Table
  id: string
  row: { id: string }
  version: number | undefined
  headSeq: number | undefined
  scopes: Scope[]
}

/** Where the rows live: IndexedDB in a browser, a fake in a unit test. */
export type ReplicaStorage = {
  account: () => Promise<string | null>
  rows: () => Promise<KeptRow[]>
  write: (account: string, puts: readonly KeptRow[], drops: readonly string[]) => Promise<void>
  drop: () => Promise<void>
}

const DB = 'su-replica'
const ROWS = 'rows'
const META = 'meta'

function keyOf(table: Table, id: string): string {
  return `${table}:${id}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(ROWS)
      request.result.createObjectStore(META)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** One transaction over both stores, closed when it settles. */
async function withDb<T>(
  mode: IDBTransactionMode,
  run: (rows: IDBObjectStore, meta: IDBObjectStore) => IDBRequest<T> | undefined
): Promise<T | undefined> {
  const db = await openDb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction([ROWS, META], mode)
      const request = run(tx.objectStore(ROWS), tx.objectStore(META))
      tx.oncomplete = () => resolve(request?.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

const hasIdb = (): boolean => typeof indexedDB !== 'undefined'

const indexedDbStorage: ReplicaStorage = {
  async account() {
    if (!hasIdb()) return null
    const account = await withDb<string | undefined>('readonly', (_, meta) => meta.get('account'))
    return account ?? null
  },
  async rows() {
    if (!hasIdb()) return []
    return (await withDb<KeptRow[]>('readonly', (rows) => rows.getAll())) ?? []
  },
  async write(account, puts, drops) {
    if (!hasIdb()) return
    await withDb('readwrite', (rows, meta) => {
      meta.put(account, 'account')
      for (const p of puts) rows.put(p, keyOf(p.table, p.id))
      for (const key of drops) rows.delete(key)
      return undefined
    })
  },
  async drop() {
    if (!hasIdb()) return
    await withDb('readwrite', (rows, meta) => {
      rows.clear()
      meta.clear()
      return undefined
    })
  },
}

let storage: ReplicaStorage = indexedDbStorage

/** A unit test's own storage; `null` puts the browser's back. */
export function setReplicaStorage(next: ReplicaStorage | null): void {
  storage = next ?? indexedDbStorage
}

/** `@convex-dev/auth`'s session token key, before its per-deployment suffix. */
const SESSION_TOKEN_KEY = '__convexAuthJWT'

/**
 * The account whose session is on this device: the session token's subject,
 * `<userId>|<sessionId>`, read without verifying it (the server verifies; this
 * only names whose rows to read). `null` when there is no session.
 */
export function sessionAccount(
  store: Pick<Storage, 'length' | 'key' | 'getItem'> | null = localStore()
): string | null {
  if (store === null) return null
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i)
    if (key === null || !key.startsWith(SESSION_TOKEN_KEY)) continue
    const subject = tokenSubject(store.getItem(key))
    if (subject !== null) return subject.split('|')[0] || null
  }
  return null
}

function tokenSubject(token: string | null): string | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}

/**
 * Writes run one after another, so an older batch never lands after a newer
 * one. A failed write costs only the device's copy, never what is on screen.
 */
let queue: Promise<void> = Promise.resolve()
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => undefined)
  return queue
}

function kept(changes: readonly Change[]): { puts: KeptRow[]; drops: string[] } {
  const last = new Map<string, Change>()
  for (const c of changes) last.set(keyOf(c.table, c.id), c)
  const puts: KeptRow[] = []
  const drops: string[] = []
  for (const [key, c] of last) {
    if (c.kind === 'drop') drops.push(key)
    else
      puts.push({
        table: c.table,
        id: c.id,
        row: c.held.row,
        version: c.held.version,
        headSeq: c.held.headSeq,
        scopes: [...c.held.scopes],
      })
  }
  return { puts, drops }
}

let stopKeeping: (() => void) | null = null

/**
 * Keep `account`'s rows on the device: read back what the last load kept
 * (unless a served answer got there first, `restore`), then write each change
 * as it happens. Resolves once the read is done. A copy kept for another
 * account is dropped unread.
 */
export async function keepOnDevice(account: string): Promise<void> {
  stopKeeping?.()
  stopKeeping = onChanges((changes) => {
    const { puts, drops } = kept(changes)
    void enqueue(() => storage.write(account, puts, drops))
  })
  try {
    const owner = await storage.account()
    if (owner !== null && owner !== account) {
      await enqueue(() => storage.drop())
      return
    }
    restore(await storage.rows())
  } catch {
    // Unreadable: start from the server's answer alone.
  }
}

/** The session ended: stop keeping, and drop what was kept. */
export function dropFromDevice(): Promise<void> {
  stopKeeping?.()
  stopKeeping = null
  return enqueue(() => storage.drop())
}

/** A unit test's reset. */
export function resetPersist(): void {
  stopKeeping?.()
  stopKeeping = null
  queue = Promise.resolve()
}
