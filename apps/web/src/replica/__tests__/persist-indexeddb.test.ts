/**
 * The replica on the device, through IndexedDB itself (`persist.ts`'s own
 * storage, the one a browser runs): rows and the outbox's waiting ops survive
 * a reload for the account that kept them, another account's copy is dropped
 * unread, and a database that refuses costs only the device's copy.
 *
 * The test runner has no IndexedDB, so `fakeIndexedDb` is the least of one
 * `persist.ts` uses: a versioned open, two stores, one transaction at a time.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { SESSION_KEY } from '../../lib/auth/storedSession'
import {
  dropFromDevice,
  keepOnDevice,
  keepOutbox,
  readOutbox,
  resetPersist,
  setReplicaStorage,
} from '../persist'
import { getView, hold } from '../replica'
import { resetStores } from './resetStores'

type Refusal = 'open' | 'transaction' | null

/** An in-memory IndexedDB: what each store holds outlives every open and close. */
function fakeIndexedDb() {
  const stores = new Map<string, Map<string, unknown>>()
  const state = { refuse: null as Refusal, opens: 0, closes: 0 }
  const settled = <T>(result: T) => ({ result }) as IDBRequest<T>
  const indexedDB = {
    open() {
      const request = {
        result: undefined as unknown,
        error: new Error('refused'),
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      }
      queueMicrotask(() => {
        if (state.refuse === 'open') return request.onerror?.()
        state.opens += 1
        const fresh = stores.size === 0
        request.result = {
          createObjectStore: (name: string) => stores.set(name, new Map()),
          close: () => {
            state.closes += 1
          },
          transaction(names: string[]) {
            const tx = {
              error: new Error('aborted'),
              oncomplete: null as (() => void) | null,
              onerror: null as (() => void) | null,
              onabort: null as (() => void) | null,
              objectStore(name: string) {
                if (!names.includes(name)) throw new Error(`store ${name} is not in scope`)
                const held = stores.get(name) as Map<string, unknown>
                return {
                  get: (key: string) => settled(held.get(key)),
                  getAll: () => settled([...held.values()]),
                  put: (value: unknown, key: string) => settled(held.set(key, value) && key),
                  delete: (key: string) => settled(held.delete(key)),
                  clear: () => settled(held.clear()),
                }
              },
            }
            queueMicrotask(() =>
              state.refuse === 'transaction' ? tx.onabort?.() : tx.oncomplete?.()
            )
            return tx
          },
        }
        if (fresh) request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
  return { indexedDB, stores, state }
}

const realIdb = (globalThis as { indexedDB?: unknown }).indexedDB
let device: ReturnType<typeof fakeIndexedDb>

/** Let the write queue drain. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** The page reloads: memory is gone, the device is not. */
function reload() {
  resetPersist()
  resetStores()
}

beforeEach(() => {
  resetStores()
  setReplicaStorage(null)
  device = fakeIndexedDb()
  ;(globalThis as { indexedDB?: unknown }).indexedDB = device.indexedDB
  localStorage.setItem(SESSION_KEY, 'u1')
})

afterEach(async () => {
  resetPersist()
  await settle()
  ;(globalThis as { indexedDB?: unknown }).indexedDB = realIdb
  localStorage.removeItem(SESSION_KEY)
})

const holdPilot = (id: string, name: string) =>
  hold('pilot', pilotFixture({ id, name }), { version: 2, headSeq: 1 })

/** The pilots on screen, by name. */
const onScreen = () =>
  getView()
    .pilots.map((p) => p.name)
    .sort()

describe('the device’s copy, in IndexedDB', () => {
  test('a row held on one load is on screen at the next, for the same account', async () => {
    await keepOnDevice('u1')
    holdPilot('p1', 'Kept')
    await settle()
    expect(device.stores.get('meta')?.get('account')).toBe('u1')
    expect([...(device.stores.get('rows')?.keys() ?? [])]).toEqual(['pilot:p1'])

    reload()
    expect(onScreen()).toEqual([])
    await keepOnDevice('u1')
    expect(onScreen()).toEqual(['Kept'])
    // Every transaction closed the database it opened.
    expect(device.state.closes).toBe(device.state.opens)
  })

  test('another account’s copy is dropped unread', async () => {
    await keepOnDevice('u1')
    holdPilot('p1', 'Theirs')
    await settle()

    reload()
    await keepOnDevice('u2')
    expect(onScreen()).toEqual([])
    expect(device.stores.get('rows')?.size).toBe(0)
    expect(device.stores.get('meta')?.size).toBe(0)
  })

  test('signing out drops the rows and the stamp', async () => {
    await keepOnDevice('u1')
    holdPilot('p1', 'Kept')
    await settle()
    await dropFromDevice()
    expect(device.stores.get('rows')?.size).toBe(0)
    expect(device.stores.get('meta')?.has('account')).toBe(false)
  })

  test('a database that will not open starts from the server alone, and keeps nothing', async () => {
    device.state.refuse = 'open'
    await keepOnDevice('u1')
    holdPilot('p1', 'On screen')
    await settle()
    expect(onScreen()).toEqual(['On screen'])
    expect(device.stores.size).toBe(0)
  })

  test('a write the database aborts costs only the device’s copy', async () => {
    await keepOnDevice('u1')
    device.state.refuse = 'transaction'
    holdPilot('p1', 'On screen')
    await settle()
    expect(onScreen()).toEqual(['On screen'])
    // The queue is not stuck behind the failure: the next write lands.
    device.state.refuse = null
    holdPilot('p2', 'Later')
    await settle()
    expect(device.stores.get('rows')?.has('pilot:p2')).toBe(true)
  })

  test('with no IndexedDB at all, nothing is kept and nothing throws', async () => {
    ;(globalThis as { indexedDB?: unknown }).indexedDB = undefined
    await keepOnDevice('u1')
    holdPilot('p1', 'On screen')
    await settle()
    await dropFromDevice()
    expect(onScreen()).toEqual(['On screen'])
    expect(await readOutbox()).toEqual([])
    await keepOutbox([{ id: 'w1' }])
    expect(device.state.opens).toBe(0)
  })
})

describe('the outbox’s waiting ops, beside the rows', () => {
  test('are read back for the account whose session is on the device', async () => {
    await keepOutbox([{ id: 'w1' }, { id: 'w2' }])
    expect(await readOutbox<{ id: string }>()).toEqual([{ id: 'w1' }, { id: 'w2' }])
  })

  test('are empty for another account, and for nobody', async () => {
    await keepOutbox([{ id: 'w1' }])
    localStorage.setItem(SESSION_KEY, 'u2')
    expect(await readOutbox()).toEqual([])
    localStorage.removeItem(SESSION_KEY)
    expect(await readOutbox()).toEqual([])
    await keepOutbox([{ id: 'w9' }])
    expect(device.stores.get('meta')?.get('outbox')).toMatchObject({ writes: [{ id: 'w1' }] })
  })

  test('are dropped with the rows', async () => {
    await keepOutbox([{ id: 'w1' }])
    await dropFromDevice()
    expect(await readOutbox()).toEqual([])
  })

  test('an unreadable database reads as an empty outbox', async () => {
    await keepOutbox([{ id: 'w1' }])
    device.state.refuse = 'open'
    expect(await readOutbox()).toEqual([])
  })
})
