/**
 * chunkRecovery — the deploy-skew reload guard.
 *
 * These exercise the real listener against the real `window`, driving it with a
 * dispatched `vite:preloadError` event. Storage/clock/reload are injected, so
 * no `mock.module` is involved and nothing leaks into later files in the
 * process (see .claude/rules/testing-patterns.md).
 */
import { describe, expect, it } from 'bun:test'
import { installChunkRecovery } from '../chunkRecovery'

/** Minimal in-memory Storage stand-in. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed))
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
  return {
    get length(): number {
      throw new Error('denied')
    },
    clear: () => {
      throw new Error('denied')
    },
    getItem: () => {
      throw new Error('denied')
    },
    key: () => {
      throw new Error('denied')
    },
    removeItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    },
  } as unknown as Storage
}

function firePreloadError(): Event {
  const event = new Event('vite:preloadError', { cancelable: true })
  Object.defineProperty(event, 'payload', {
    value: new Error('Failed to fetch dynamically imported module: /assets/x-OLDHASH.js'),
  })
  window.dispatchEvent(event)
  return event
}

describe('installChunkRecovery', () => {
  it('reloads once on the first preload failure', () => {
    let reloads = 0
    const teardown = installChunkRecovery({
      storage: fakeStorage(),
      reload: () => {
        reloads += 1
      },
      now: () => 1_000_000,
    })

    firePreloadError()
    teardown()

    expect(reloads).toBe(1)
  })

  it('cancels the event so Vite does not also rethrow into the error boundary', () => {
    const teardown = installChunkRecovery({
      storage: fakeStorage(),
      reload: () => {},
      now: () => 1_000_000,
    })

    const event = firePreloadError()
    teardown()

    expect(event.defaultPrevented).toBe(true)
  })

  it('does NOT reload again inside the cooldown — this is the infinite-loop guard', () => {
    let reloads = 0
    let clock = 1_000_000
    const storage = fakeStorage()
    const teardown = installChunkRecovery({
      storage,
      reload: () => {
        reloads += 1
      },
      now: () => clock,
    })

    firePreloadError()
    clock += 5_000 // still well inside the 20s cooldown
    const second = firePreloadError()
    teardown()

    expect(reloads).toBe(1)
    // The second failure must be allowed to surface, not silently swallowed.
    expect(second.defaultPrevented).toBe(false)
  })

  it('rearms after the cooldown, so a later deploy in a long-lived tab still recovers', () => {
    let reloads = 0
    let clock = 1_000_000
    const teardown = installChunkRecovery({
      storage: fakeStorage(),
      reload: () => {
        reloads += 1
      },
      now: () => clock,
    })

    firePreloadError()
    clock += 60_000
    firePreloadError()
    teardown()

    expect(reloads).toBe(2)
  })

  it('treats a cooldown recorded by a previous page load as authoritative', () => {
    // The reload happened, the page came back, and it failed again immediately.
    // That is the loop case, and it is only detectable via persisted state.
    let reloads = 0
    const teardown = installChunkRecovery({
      storage: fakeStorage({ 'itun:chunk-reload-at': '1000000' }),
      reload: () => {
        reloads += 1
      },
      now: () => 1_002_000,
    })

    firePreloadError()
    teardown()

    expect(reloads).toBe(0)
  })

  it('still recovers when sessionStorage throws on every access', () => {
    let reloads = 0
    const teardown = installChunkRecovery({
      storage: hostileStorage(),
      reload: () => {
        reloads += 1
      },
      now: () => 1_000_000,
    })

    expect(() => firePreloadError()).not.toThrow()
    teardown()

    expect(reloads).toBe(1)
  })

  it('removes its listener on teardown', () => {
    let reloads = 0
    const teardown = installChunkRecovery({
      storage: fakeStorage(),
      reload: () => {
        reloads += 1
      },
      now: () => 1_000_000,
    })

    teardown()
    firePreloadError()

    expect(reloads).toBe(0)
  })
})
