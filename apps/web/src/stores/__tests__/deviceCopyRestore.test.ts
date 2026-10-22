/**
 * An offline boot's restore of the device copy (ADR-053): the copy's rows
 * reach the stores through the served answer's own apply, a store's
 * `hydrate()` waits for it, and a served answer this load means there is
 * nothing to restore.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { DeviceCopy, MineAnswer } from '../deviceCopy'
import {
  beginRestore,
  noteServed,
  resetDeviceCopy,
  restorePending,
  setCopyStorage,
} from '../deviceCopy'
import { resetDeviceCopyRestore, restoreDeviceCopy } from '../deviceCopyRestore'
import { setEntityBackendAuthState } from '../entityBackend'
import { useEntityStore } from '../entityStore'
import { resetStores } from './resetStores'

const KEY = '__convexAuthJWT_httpslocalhost3210'
const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
const TOKEN = `${part({ alg: 'RS256' })}.${part({ sub: 'user123|s' })}.sig`

const pilot = pilotFixture({ id: 'p-offline', name: 'Kept On This Device' })

function copy(account = 'user123'): DeviceCopy {
  return {
    account,
    savedAt: 1,
    mine: {
      pilots: [{ appId: null, updatedAt: 5, body: pilot }],
      mechs: [],
      crawlers: [],
      npcs: [],
      mechPatterns: [],
      encounterNpcs: [],
    } as unknown as MineAnswer,
    wiring: null,
  }
}

function holding(held: DeviceCopy | null): void {
  setCopyStorage({ read: async () => held, write: async () => {}, drop: async () => {} })
}

beforeEach(() => {
  resetStores()
  resetDeviceCopy()
  resetDeviceCopyRestore()
  localStorage.setItem(KEY, TOKEN)
  // Booted offline with a session on the device.
  setEntityBackendAuthState({
    signedIn: false,
    online: false,
    authSettled: false,
    storedSession: true,
  })
})

afterEach(() => {
  setCopyStorage(null)
  resetDeviceCopy()
  resetDeviceCopyRestore()
  localStorage.clear()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  resetStores()
})

describe('restoreDeviceCopy', () => {
  test("puts the copy's rows in the stores and marks them arrived", async () => {
    holding(copy())
    await restoreDeviceCopy()
    const state = useEntityStore.getState()
    expect(state.pilots.map((p) => p.name)).toEqual(['Kept On This Device'])
    expect(state.hydrated.pilots).toBe(true)
    expect(restorePending()).toBe(false)
  })

  test('a store waits for a pending restore, then reads its rows', async () => {
    holding(copy())
    beginRestore()
    const hydrated = useEntityStore.getState().hydrate('pilot')
    let done = false
    void hydrated.then(() => {
      done = true
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(done).toBe(false)
    resetDeviceCopyRestore()
    await restoreDeviceCopy()
    await hydrated
    expect(useEntityStore.getState().pilots).toHaveLength(1)
  })

  test("another account's copy is not restored", async () => {
    holding(copy('someoneElse'))
    await restoreDeviceCopy()
    expect(useEntityStore.getState().pilots).toHaveLength(0)
    expect(restorePending()).toBe(false)
  })

  test('nothing to restore once the server has answered this load', async () => {
    holding(copy())
    noteServed()
    await restoreDeviceCopy()
    expect(useEntityStore.getState().pilots).toHaveLength(0)
  })

  test('runs once per load', async () => {
    holding(copy())
    await restoreDeviceCopy()
    await useEntityStore.getState().forget('pilot', pilot.id)
    await restoreDeviceCopy()
    expect(useEntityStore.getState().pilots).toHaveLength(0)
  })
})
