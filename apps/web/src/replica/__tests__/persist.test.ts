/**
 * The replica on the device (`persist.ts`): what a load held comes back on the
 * next, for the same account only, and a session's end drops it.
 *
 * A fake `ReplicaStorage` stands in for IndexedDB, which the test runner lacks.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { SESSION_KEY } from '../../lib/auth/storedSession'
import type { KeptRow, ReplicaStorage } from '../persist'
import {
  dropFromDevice,
  keepOnDevice,
  resetPersist,
  sessionAccount,
  setReplicaStorage,
} from '../persist'
import { drop, getView, hold, versionOf } from '../replica'
import { resetStores } from './resetStores'

/** An in-memory device: the account it is stamped for, and its rows by key. */
function fakeDevice(account: string | null = null, rows: KeptRow[] = []) {
  const device = {
    account,
    rows: new Map(rows.map((r) => [`${r.table}:${r.id}`, r])),
    drops: 0,
  }
  const storage: ReplicaStorage = {
    account: async () => device.account,
    rows: async () => [...device.rows.values()],
    write: async (owner, puts, drops) => {
      device.account = owner
      for (const p of puts) device.rows.set(`${p.table}:${p.id}`, p)
      for (const key of drops) device.rows.delete(key)
    },
    drop: async () => {
      device.account = null
      device.rows.clear()
      device.drops += 1
    },
  }
  return { device, storage }
}

const kept = (id: string, name: string): KeptRow => ({
  table: 'pilot',
  id,
  row: pilotFixture({ id, name }),
  version: 3,
  headSeq: 2,
  scopes: ['account'],
})

/** Let the write queue drain. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(resetStores)
afterEach(() => {
  resetPersist()
  setReplicaStorage(null)
})

describe('keepOnDevice', () => {
  test('restores what the last load kept for the same account, with its versions', async () => {
    const { storage } = fakeDevice('u1', [kept('p1', 'Kept')])
    setReplicaStorage(storage)

    await keepOnDevice('u1')

    expect(getView().pilots.map((p) => p.name)).toEqual(['Kept'])
    expect(versionOf('pilot', 'p1')).toBe(3)
  })

  test('a row a live answer already brought stays, not the kept one', async () => {
    const { storage } = fakeDevice('u1', [kept('p1', 'Kept')])
    setReplicaStorage(storage)
    hold('pilot', pilotFixture({ id: 'p1', name: 'Live' }), { version: 9 })

    await keepOnDevice('u1')

    expect(getView().pilots.map((p) => p.name)).toEqual(['Live'])
  })

  test("drops another account's copy unread", async () => {
    const { device, storage } = fakeDevice('someone-else', [kept('p1', 'Theirs')])
    setReplicaStorage(storage)

    await keepOnDevice('u1')

    expect(getView().pilots).toEqual([])
    expect(device.rows.size).toBe(0)
    expect(device.drops).toBe(1)
  })

  test('writes each change as it happens, stamped for the account', async () => {
    const { device, storage } = fakeDevice()
    setReplicaStorage(storage)
    await keepOnDevice('u1')

    hold('pilot', pilotFixture({ id: 'p1', name: 'New' }), { version: 1, headSeq: 1 })
    await settle()
    expect(device.account).toBe('u1')
    expect(device.rows.get('pilot:p1')).toMatchObject({ version: 1, headSeq: 1 })

    drop('pilot', 'p1')
    await settle()
    expect(device.rows.has('pilot:p1')).toBe(false)
  })

  test('an unreadable device starts from the server alone', async () => {
    const { storage } = fakeDevice()
    setReplicaStorage({
      ...storage,
      account: () => Promise.reject(new Error('blocked')),
    })

    await keepOnDevice('u1')

    expect(getView().pilots).toEqual([])
  })
})

describe('dropFromDevice', () => {
  test('stops keeping and drops what was kept', async () => {
    const { device, storage } = fakeDevice()
    setReplicaStorage(storage)
    await keepOnDevice('u1')
    hold('pilot', pilotFixture({ id: 'p1', name: 'New' }), { version: 1 })

    await dropFromDevice()
    hold('pilot', pilotFixture({ id: 'p2', name: 'After' }), { version: 1 })
    await settle()

    expect(device.rows.size).toBe(0)
    expect(device.account).toBeNull()
  })
})

describe('sessionAccount', () => {
  const store = (entries: Record<string, string>) => ({
    getItem: (k: string) => entries[k] ?? null,
  })

  test("is the device's stored session", () => {
    expect(sessionAccount(store({ [SESSION_KEY]: 'u1' }))).toBe('u1')
  })

  test('is null with no session or no storage', () => {
    expect(sessionAccount(store({ other: 'u1' }))).toBeNull()
    expect(sessionAccount(null)).toBeNull()
  })
})
