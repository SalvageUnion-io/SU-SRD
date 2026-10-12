import { afterEach, describe, expect, test } from 'bun:test'
import { CONNECTION_MODES } from '../../lib/connection/connectionMode'
import {
  backendForMode,
  backendSettling,
  crawlerPatchArgs,
  requireWritableBackend,
  selectBackend,
  setEntityBackendAuthState,
  subscribeBackend,
  WritesBlockedOffline,
} from '../entityBackend'

/**
 * Backend selection (ADR-030 §1, ADR-034 decision 1).
 *
 * Three answers, two of them refusals: `signedOut` for anybody not signed
 * in (read-only, and holds nothing), `remote` for a Connected session, `blocked` while Disconnected or still
 * settling the auth handshake. The tests below pin that no combination of
 * inputs yields a durable anonymous backend.
 */

afterEach(() => {
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('signed out', () => {
  test('is signedOut, and an omitted authSettled reads as settled', () => {
    setEntityBackendAuthState({ signedIn: false, online: true })
    expect(selectBackend()).toBe('signedOut')
    expect(refusalReason()).toBe('signedOut')
  })
})

describe('an anonymous write is refused', () => {
  test('as signed out, online or off — building needs an account (ADR-034 as amended)', () => {
    // Offline + signed out is Solo, not Disconnected, so the refusal asks for a
    // sign-in rather than blaming the connection.
    for (const online of [true, false]) {
      setEntityBackendAuthState({ signedIn: false, online, authSettled: true })
      expect(refusalReason()).toBe('signedOut')
    }
  })
})

/** The reason `requireWritableBackend` refuses with, or null if it allows. */
function refusalReason(): string | null {
  try {
    requireWritableBackend()
    return null
  } catch (err) {
    if (err instanceof WritesBlockedOffline) return err.reason
    throw err
  }
}

describe('the signed-in backend the durability tests run on', () => {
  test('a settled, online, signed-in session is remote', () => {
    // What `withSignedInBackend()` pushes. If this stopped resolving to
    // `remote`, every durability test would quietly start asserting against
    // the signed-out backend instead.
    setEntityBackendAuthState({
      signedIn: true,
      online: true,
      authSettled: true,
    })
    expect(selectBackend()).toBe('remote')
    expect(requireWritableBackend()).toBe('remote')
  })

  test('the same session offline is blocked, with the offline reason', () => {
    setEntityBackendAuthState({
      signedIn: true,
      online: false,
      authSettled: true,
    })
    expect(selectBackend()).toBe('blocked')
    expect(() => requireWritableBackend()).toThrow(WritesBlockedOffline)
  })

  test('mid-handshake is blocked with the settling reason', () => {
    setEntityBackendAuthState({
      signedIn: false,
      online: true,
      authSettled: false,
    })
    let caught: unknown = null
    try {
      requireWritableBackend()
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(WritesBlockedOffline)
    expect((caught as WritesBlockedOffline).reason).toBe('settling')
  })

  test('a bundle below the build floor is blocked with the outdated reason', () => {
    // Connected in every other respect: the backend has moved past this build,
    // so a write may call a function it no longer has.
    setEntityBackendAuthState({
      signedIn: true,
      online: true,
      authSettled: true,
      outdated: true,
    })
    expect(selectBackend()).toBe('blocked')
    expect(refusalReason()).toBe('outdated')
    expect(new WritesBlockedOffline('outdated').message).toMatch(/updated/i)
  })
})

describe('WritesBlockedOffline', () => {
  test('carries the same wording as the banner', () => {
    // The user reads one of these in a toast and the other in the banner; if
    // they disagree it looks like two different faults.
    expect(new WritesBlockedOffline().message).toMatch(/read-only until the connection returns/i)
  })

  test('is identifiable by name across a structured-clone boundary', () => {
    // instanceof does not survive being re-thrown through some boundaries, so
    // callers match on name — that has to keep working.
    expect(new WritesBlockedOffline().name).toBe('WritesBlockedOffline')
  })

  test('the settling refusal says something different, because it IS different', () => {
    // "Read-only until the connection returns" would be a lie during the
    // handshake: nothing is wrong and it resolves by itself in a moment.
    const settling = new WritesBlockedOffline('settling')
    expect(settling.reason).toBe('settling')
    expect(settling.message).toMatch(/still signing in/i)
    expect(new WritesBlockedOffline().reason).toBe('offline')
  })
})

describe('backendForMode — the whole rule', () => {
  test('every mode maps to exactly one of the three backends', () => {
    expect(backendForMode('solo')).toBe('signedOut')
    expect(backendForMode('connected')).toBe('remote')
    expect(backendForMode('disconnected')).toBe('blocked')
    expect(backendForMode('connecting')).toBe('blocked')
  })

  test('there is no input that yields a durable anonymous backend', () => {
    // The rule takes the mode and nothing else, which makes a `local` comeback
    // unwritable rather than merely unwritten: there is no argument left to
    // pass it through.
    expect(backendForMode.length).toBe(1)
    for (const mode of CONNECTION_MODES) {
      expect(['remote', 'blocked', 'signedOut']).toContain(backendForMode(mode))
    }
  })
})

describe('subscribeBackend — the stores hear every push', () => {
  test('a listener runs on each push until it unsubscribes', () => {
    let heard = 0
    const stop = subscribeBackend(() => {
      heard += 1
    })
    setEntityBackendAuthState({ signedIn: true, online: true, authSettled: true })
    setEntityBackendAuthState({ signedIn: true, online: false, authSettled: true })
    stop()
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    expect(heard).toBe(2)
  })

  test('backendSettling is true only for the handshake', () => {
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: false })
    expect(backendSettling()).toBe(true)
    setEntityBackendAuthState({ signedIn: true, online: true, authSettled: true })
    expect(backendSettling()).toBe(false)
  })
})

describe('a crawler field patch names the fields it clears', () => {
  // The Convex client drops undefined object fields on the wire, so a cleared
  // field (the ↺ revert of a pinned Max SP) has to travel as `unset` — see the
  // server side in `test/convex/entities.test.ts`.
  test('an undefined value becomes an unset key', () => {
    expect(crawlerPatchArgs('c1', { maxSpOverride: undefined, scrap: 4 })).toEqual({
      appId: 'c1',
      patch: { maxSpOverride: undefined, scrap: 4 },
      unset: ['maxSpOverride'],
    })
  })

  test('a patch that clears nothing sends no unset', () => {
    expect(crawlerPatchArgs('c1', { scrap: 4 })).toEqual({ appId: 'c1', patch: { scrap: 4 } })
  })
})
