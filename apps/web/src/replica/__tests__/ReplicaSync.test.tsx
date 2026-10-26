import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'

/**
 * `ReplicaSync`: signed out after a session, every held row goes; booted
 * offline, the device's copy is the answer; offline or outdated, no feed is
 * mounted. What the rooms' feed folds in is `roomSocket.test.ts`'s.
 */

import { installConvexMocks } from '../../components/__tests__/convexMock'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { SyncStatus } from '../sync'

const convexMocks = await installConvexMocks()

const { ReplicaSync } = await import('../ReplicaSync')
const { SyncContext } = await import('../syncContext')
const { useUnits } = await import('../units')
const { getView, hold } = await import('../replica')
const { resetPersist, setReplicaStorage } = await import('../persist')
const { resetStores } = await import('./resetStores')
const { resetSync, setSyncStatus } = await import('../sync')

afterAll(() => {
  convexMocks.restore()
})

function tree(status: SyncStatus, outdated = false) {
  return (
    <SyncContext.Provider value={{ status, canWrite: status === 'live' && !outdated, outdated }}>
      <ReplicaSync />
    </SyncContext.Provider>
  )
}

beforeEach(() => {
  resetStores()
})
afterEach(() => {
  resetPersist()
  setReplicaStorage(null)
  localStorage.clear()
  resetSync()
})

describe('the session', () => {
  test('signing out drops every held row', async () => {
    const view = render(tree('offline'))
    hold('pilot', pilotFixture({ id: 'p1' }), { version: 1 })
    expect(getView().pilots).toHaveLength(1)

    await act(async () => view.rerender(tree('signedOut')))

    expect(getView().pilots).toEqual([])
  })

  test('booted offline with a session, the device’s copy is the answer', async () => {
    localStorage.setItem('su:session', 'u1')
    const kept = {
      table: 'pilot' as const,
      id: 'p1',
      row: pilotFixture({ id: 'p1', name: 'Kept' }),
      version: 1,
      headSeq: 1,
      scopes: ['account' as const],
    }
    setReplicaStorage({
      account: async () => 'u1',
      rows: async () => [kept],
      write: async () => {},
      drop: async () => {},
    })

    // What `SyncProvider` publishes to the replica's writers.
    setSyncStatus('offline')
    render(tree('offline'))

    await act(async () => {
      await useUnits.getState().hydrate('pilot')
    })
    expect(getView().pilots.map((p) => p.name)).toEqual(['Kept'])
    expect(getView().hydrated.mechs).toBe(true)
  })

  test('offline or outdated, nothing is fed', async () => {
    const view = render(tree('offline'))
    await act(async () => view.rerender(tree('live', true)))
    expect(getView().pilots).toEqual([])
  })
})
