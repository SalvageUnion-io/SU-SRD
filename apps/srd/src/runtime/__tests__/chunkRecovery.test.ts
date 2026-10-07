/**
 * chunkRecovery — one guarded reload when a page outlives its build's chunks.
 *
 * Drives the real listener on the real `window` with a dispatched
 * `vite:preloadError`. Storage, clock and reload are injected, so nothing is
 * mocked process-wide (see .claude/rules/testing-patterns.md).
 */
import { describe, expect, test } from 'bun:test'
import { installChunkRecovery } from '../chunkRecovery.client'

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage
}

/** A storage whose every access throws, as in a locked-down privacy mode. */
function hostileStorage(): Storage {
  const denied = () => {
    throw new Error('denied')
  }
  return { getItem: denied, setItem: denied } as unknown as Storage
}

function firePreloadError(): Event {
  const event = new Event('vite:preloadError', { cancelable: true })
  Object.defineProperty(event, 'payload', {
    value: new TypeError(
      'Failed to fetch dynamically imported module: /assets/SearchIsland-OLD.js'
    ),
  })
  window.dispatchEvent(event)
  return event
}

function install(storage: Storage, clock: { at: number }) {
  const calls = { reloads: 0 }
  const teardown = installChunkRecovery({
    storage,
    reload: () => {
      calls.reloads += 1
    },
    now: () => clock.at,
  })
  return { calls, teardown }
}

describe('installChunkRecovery', () => {
  test('reloads once when an island chunk fails to load', () => {
    const { calls, teardown } = install(fakeStorage(), { at: 1_000_000 })

    const event = firePreloadError()
    teardown()

    expect(calls.reloads).toBe(1)
    // Cancelled, so Vite does not also rethrow into the island's catch.
    expect(event.defaultPrevented).toBe(true)
  })

  test('does not reload again inside the cooldown — the loop guard', () => {
    // The offline case: the reload serves the same stale cached page, and its
    // chunks fail the same way. A second reload would loop forever.
    const clock = { at: 1_000_000 }
    const { calls, teardown } = install(fakeStorage(), clock)

    firePreloadError()
    clock.at += 5_000
    const second = firePreloadError()
    teardown()

    expect(calls.reloads).toBe(1)
    expect(second.defaultPrevented).toBe(false)
  })

  test('rearms after the cooldown, so a later deploy in the same tab recovers', () => {
    const clock = { at: 1_000_000 }
    const { calls, teardown } = install(fakeStorage(), clock)

    firePreloadError()
    clock.at += 60_000
    firePreloadError()
    teardown()

    expect(calls.reloads).toBe(2)
  })

  test('still recovers when storage is denied', () => {
    const { calls, teardown } = install(hostileStorage(), { at: 1_000_000 })

    expect(() => firePreloadError()).not.toThrow()
    teardown()

    expect(calls.reloads).toBe(1)
  })

  test('teardown removes the listener', () => {
    const { calls, teardown } = install(fakeStorage(), { at: 1_000_000 })
    teardown()

    firePreloadError()

    expect(calls.reloads).toBe(0)
  })
})
