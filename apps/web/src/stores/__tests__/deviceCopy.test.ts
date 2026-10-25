/**
 * The device copy (ADR-058): whose it is, what is kept, and that it is only
 * ever read back for the account whose session is on the device.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { SESSION_KEY } from '../../lib/auth/storedSession'
import type { CopyStorage, DeviceCopy, MineAnswer, WiringAnswer } from '../deviceCopy'
import {
  dropCopy,
  readCopy,
  resetDeviceCopy,
  saveCopy,
  sessionAccount,
  setCopyStorage,
} from '../deviceCopy'

/** An in-memory stand-in for IndexedDB. */
function memoryStorage(): CopyStorage & { held: () => DeviceCopy | null } {
  let held: DeviceCopy | null = null
  return {
    held: () => held,
    read: async () => held,
    write: async (copy) => {
      held = copy
    },
    drop: async () => {
      held = null
    },
  }
}

const MINE = {
  pilots: [{ appId: null, updatedAt: 1, body: { id: 'p1' } }],
  mechs: [],
  crawlers: [],
  npcs: [],
  mechPatterns: [],
  encounterNpcs: [],
} as unknown as MineAnswer

const WIRING = { gameIds: [], softLinks: [], crawlers: [] } as unknown as WiringAnswer

let storage: ReturnType<typeof memoryStorage>

beforeEach(() => {
  storage = memoryStorage()
  setCopyStorage(storage)
  resetDeviceCopy()
  localStorage.clear()
})

afterEach(() => {
  setCopyStorage(null)
  resetDeviceCopy()
  localStorage.clear()
})

describe('sessionAccount', () => {
  test('reads the account from the stored session', () => {
    localStorage.setItem(SESSION_KEY, 'user123')
    expect(sessionAccount()).toBe('user123')
  })

  test('no session, no account', () => {
    expect(sessionAccount()).toBeNull()
  })

  test('an emptied session is no account', () => {
    localStorage.setItem(SESSION_KEY, '')
    expect(sessionAccount()).toBeNull()
  })
})

describe('the copy', () => {
  test('keeps both halves, stamped with the account', async () => {
    localStorage.setItem(SESSION_KEY, 'user123')
    await saveCopy({ mine: MINE })
    await saveCopy({ wiring: WIRING })
    const copy = await readCopy()
    expect(copy?.account).toBe('user123')
    expect(copy?.mine).toEqual(MINE)
    expect(copy?.wiring).toEqual(WIRING)
  })

  test('is not saved without a session', async () => {
    await saveCopy({ mine: MINE })
    expect(storage.held()).toBeNull()
  })

  test("is never read for another account's session", async () => {
    localStorage.setItem(SESSION_KEY, 'user123')
    await saveCopy({ mine: MINE })
    localStorage.setItem(SESSION_KEY, 'someoneElse')
    expect(await readCopy()).toBeNull()
  })

  test('is gone once dropped', async () => {
    localStorage.setItem(SESSION_KEY, 'user123')
    await saveCopy({ mine: MINE })
    await dropCopy()
    expect(await readCopy()).toBeNull()
  })

  test('a storage that refuses costs only the copy', async () => {
    localStorage.setItem(SESSION_KEY, 'user123')
    setCopyStorage({
      read: () => Promise.reject(new Error('blocked')),
      write: () => Promise.reject(new Error('blocked')),
      drop: () => Promise.reject(new Error('blocked')),
    })
    await saveCopy({ mine: MINE })
    expect(await readCopy()).toBeNull()
  })
})
