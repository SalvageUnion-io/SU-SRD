/**
 * The device copy (ADR-058): the signed-in player's own rows, kept on this
 * device so an offline reload can show them, read-only.
 *
 * Convex stays the server of record (ADR-030). The copy is the last answer
 * `ShelfSync` applied from `entities.listMine` and `entities.listWiring`, and
 * `EncounterSync` from `shelf.encounters` (the Mediator's prep, ADR-059),
 * saved verbatim after each emission, and it is only ever READ back into the
 * stores, through the same apply as a served answer
 * (`shelfApply.ts`), when the app boots offline with a session
 * on the device. Nothing is written while offline (`writesAllowed`), so the
 * copy never holds a change the server has not accepted, and there is nothing
 * to merge when the connection returns: the server's next answer wins.
 *
 * ## Whose copy
 *
 * One copy, the account's whose session is on the device. The account is read
 * from the session token `@convex-dev/auth` keeps in `localStorage`
 * (`sessionAccount`), the same token the handshake would send, and the copy is
 * stamped with it; a copy stamped for another account is never read. Signing
 * out drops it (`sessionRows.ts`), on whichever tab saw the session end.
 *
 * ## Where
 *
 * IndexedDB, one database, one store, one record: the two answers as served,
 * kept out of `localStorage`'s small quota. Where IndexedDB is missing or refuses (a private window, a
 * test runner) the copy is simply absent: offline reloads behave as before.
 */

import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'
import { localStore } from '../lib/safeLocalStorage'

/** `entities.listMine`'s answer, as `ShelfSync` applies it. */
export type MineAnswer = FunctionReturnType<typeof api.entities.listMine>
/** `entities.listWiring`'s answer, as `WiringSync` applies it. */
export type WiringAnswer = FunctionReturnType<typeof api.entities.listWiring>
/** `shelf.encounters`' answer, as `EncounterSync` applies it. */
export type EncountersAnswer = FunctionReturnType<typeof api.shelf.encounters>

export type DeviceCopy = {
  /** The account the rows are, from the session token's subject. */
  account: string
  /** When the copy was last written, in ms. */
  savedAt: number
  mine: MineAnswer | null
  wiring: WiringAnswer | null
  /** Absent on a copy saved before encounters were kept; read as none. */
  encounters?: EncountersAnswer | null
}

/** Where the copy lives; IndexedDB in a browser, a fake in a unit test. */
export type CopyStorage = {
  read: () => Promise<DeviceCopy | null>
  write: (copy: DeviceCopy) => Promise<void>
  drop: () => Promise<void>
}

const DB = 'su-device-copy'
const STORE = 'copy'
const KEY = 'sheets'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** One transaction on the copy's store, closed when it settles. */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** The browser's: IndexedDB, or nothing where there is none. */
const indexedDbStorage: CopyStorage = {
  async read() {
    if (typeof indexedDB === 'undefined') return null
    const copy = await withStore(
      'readonly',
      (s) => s.get(KEY) as IDBRequest<DeviceCopy | undefined>
    )
    return copy ?? null
  },
  async write(copy) {
    if (typeof indexedDB === 'undefined') return
    await withStore('readwrite', (s) => s.put(copy, KEY))
  },
  async drop() {
    if (typeof indexedDB === 'undefined') return
    await withStore('readwrite', (s) => s.delete(KEY))
  },
}

let storage: CopyStorage = indexedDbStorage

/** A unit test's own storage; `null` puts the browser's back. */
export function setCopyStorage(next: CopyStorage | null): void {
  storage = next ?? indexedDbStorage
}

/** `@convex-dev/auth`'s session token key, before its per-deployment suffix. */
const SESSION_TOKEN_KEY = '__convexAuthJWT'

/**
 * The account whose session is on this device: the session token's subject,
 * `<userId>|<sessionId>`, read without verifying it (the server verifies; this
 * only names whose copy to read). `null` when there is no session or no
 * readable token.
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
 * Writes run one after another, so an older emission's write never lands
 * after a newer one's. A failed write costs only the copy, never the sync.
 */
let queue: Promise<void> = Promise.resolve()
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => undefined)
  return queue
}

/** The copy as this tab last wrote it, so each half saves without a read. */
let latest: DeviceCopy | null = null

/** Save one part of the account's served rows, after its sync applied it. */
export function saveCopy(
  part: { mine: MineAnswer } | { wiring: WiringAnswer } | { encounters: EncountersAnswer }
): Promise<void> {
  const account = sessionAccount()
  if (account === null) return Promise.resolve()
  const base = latest?.account === account ? latest : { account, mine: null, wiring: null }
  latest = { ...base, ...part, savedAt: Date.now() }
  const copy = latest
  return enqueue(() => storage.write(copy))
}

/** The copy for the account whose session is on the device, if there is one. */
export async function readCopy(): Promise<DeviceCopy | null> {
  const account = sessionAccount()
  if (account === null) return null
  try {
    const copy = await storage.read()
    return copy?.account === account ? copy : null
  } catch {
    return null
  }
}

/** Drop the copy: the session ended. */
export function dropCopy(): Promise<void> {
  latest = null
  return enqueue(() => storage.drop())
}

// ── The boot restore's bookkeeping, read by `rowArrival.ts` ──────────────

type RestoreState = 'pending' | 'done'

/**
 * Pending from the first line of an offline boot with a session on the
 * device, so a route opened at boot waits for the copy (its skeleton) rather
 * than drawing an empty roster that fills a moment later. Done once the copy
 * is applied, found missing, or the connection came back first.
 */
let restore: RestoreState =
  typeof navigator !== 'undefined' && navigator.onLine === false && sessionAccount() !== null
    ? 'pending'
    : 'done'

/** Whether this load has had a served answer: then there is nothing to restore. */
let served = false

const restoreListeners = new Set<() => void>()

/** Whether the boot restore may still put rows in the stores. */
export function restorePending(): boolean {
  return restore === 'pending'
}

/** Hear the restore settle. Returns the unsubscribe. */
export function onRestoreSettled(listener: () => void): () => void {
  restoreListeners.add(listener)
  return () => {
    restoreListeners.delete(listener)
  }
}

/** The restore is over, applied or not. */
export function settleRestore(): void {
  if (restore === 'done') return
  restore = 'done'
  for (const listener of [...restoreListeners]) listener()
}

/** Mark the restore as running (an offline boot, seen after the module loaded). */
export function beginRestore(): void {
  if (served || restore === 'pending') return
  restore = 'pending'
  for (const listener of [...restoreListeners]) listener()
}

/** `ShelfSync` applied a served answer this load. */
export function noteServed(): void {
  served = true
}

/** Whether this load has applied a served answer. */
export function hasServed(): boolean {
  return served
}

/** A unit test's reset of the module's bookkeeping. */
export function resetDeviceCopy(): void {
  latest = null
  served = false
  restore = 'done'
  queue = Promise.resolve()
}
