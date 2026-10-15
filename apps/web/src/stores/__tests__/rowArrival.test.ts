/**
 * When a store's rows have arrived, and what happens to them when the session
 * ends.
 *
 * There is no device cache: a store holds what `ShelfSync` brought down this
 * page load. `hydrate()` therefore waits only while rows are on their way —
 * the auth handshake, or a mounted sync that has not answered yet — and a tab
 * whose session ends drops what it held (`forgetLoadedRows`).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mechFixture, pilotFixture, softLinkFixture } from '../../components/__tests__/fixtures'
import { setEntityBackendAuthState } from '../entityBackend'
import { useEntityStore } from '../entityStore'
import { usePatternStore } from '../patternStore'
import { registerSync, untilRowsArrive } from '../rowArrival'
import { knownVersion, noteVersion } from '../serverVersions'
import { forgetLoadedRows } from '../sessionRows'
import { resetStores } from './resetStores'

const SIGNED_IN = { signedIn: true, online: true, authSettled: true } as const
const ANONYMOUS = { signedIn: false, online: true, authSettled: true } as const

/** Whether `promise` has settled after the microtask queue drains. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false
  void promise.then(() => {
    done = true
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return done
}

const unregisters: Array<() => void> = []

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  for (const unregister of unregisters.splice(0)) unregister()
  setEntityBackendAuthState(ANONYMOUS)
  resetStores()
})

describe('hydrate resolves at once when no rows are coming', () => {
  test('signed out', async () => {
    await useEntityStore.getState().hydrate('pilot')
    expect(useEntityStore.getState().hydrated.pilots).toBe(true)
  })

  test('signed in with no sync mounted', async () => {
    setEntityBackendAuthState(SIGNED_IN)
    await usePatternStore.getState().hydrate()
    expect(usePatternStore.getState().hydrated).toBe(true)
  })

  test('Disconnected, even with a sync mounted', async () => {
    unregisters.push(registerSync())
    setEntityBackendAuthState({ signedIn: true, online: false, authSettled: true })
    expect(await settled(useEntityStore.getState().hydrate('mech'))).toBe(true)
  })
})

describe('hydrate waits while rows are on their way', () => {
  test('a mounted sync is waited for until it marks the store arrived', async () => {
    setEntityBackendAuthState(SIGNED_IN)
    unregisters.push(registerSync())
    const pilots = useEntityStore.getState().hydrate('pilot')
    const patterns = usePatternStore.getState().hydrate()
    expect(await settled(pilots)).toBe(false)
    expect(await settled(patterns)).toBe(false)

    useEntityStore.getState().markArrived(['pilot'])
    usePatternStore.getState().markArrived()

    expect(await settled(pilots)).toBe(true)
    expect(await settled(patterns)).toBe(true)
    // Marking one type leaves the others waiting.
    expect(useEntityStore.getState().hydrated.mechs).toBe(false)
  })

  test('the handshake is waited out, and a sign-out ends the wait', async () => {
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: false })
    const pilots = useEntityStore.getState().hydrate('pilot')
    expect(await settled(pilots)).toBe(false)

    setEntityBackendAuthState(ANONYMOUS)
    expect(await settled(pilots)).toBe(true)
    expect(useEntityStore.getState().hydrated.pilots).toBe(true)
  })

  test('a sync that unmounts before answering ends the wait', async () => {
    setEntityBackendAuthState(SIGNED_IN)
    const unregister = registerSync()
    const mechs = useEntityStore.getState().hydrate('mech')
    expect(await settled(mechs)).toBe(false)

    unregister()
    // Unregistering twice is harmless.
    unregister()
    expect(await settled(mechs)).toBe(true)
  })

  test('untilRowsArrive stops listening once it resolves', async () => {
    let listeners = 0
    const subscribe = () => {
      listeners += 1
      return () => {
        listeners -= 1
      }
    }
    await untilRowsArrive(() => true, subscribe)
    expect(listeners).toBe(0)
  })
})

describe('forgetLoadedRows — the session ended', () => {
  test('drops every row and version, and leaves the stores hydrated and empty', async () => {
    const store = useEntityStore.getState()
    await store.adopt('pilot', pilotFixture({ id: 'p1' }))
    await store.adopt('mech', mechFixture({ id: 'm1' }))
    await store.adopt('softLink', softLinkFixture('mech-to-pilot', 'm1', 'p1'))
    noteVersion('p1', 5)

    forgetLoadedRows()

    const after = useEntityStore.getState()
    expect(after.pilots).toEqual([])
    expect(after.mechs).toEqual([])
    expect(after.softLinks).toEqual([])
    expect(Object.values(after.hydrated).every(Boolean)).toBe(true)
    expect(usePatternStore.getState()).toMatchObject({ mechPatterns: [], hydrated: true })
    expect(knownVersion('p1')).toBeUndefined()
  })
})
