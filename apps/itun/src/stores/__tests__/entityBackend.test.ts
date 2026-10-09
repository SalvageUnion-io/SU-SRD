import { afterEach, describe, expect, test } from 'bun:test'
import { CONNECTION_MODES } from '../../lib/connection/connectionMode'
import {
  backendForMode,
  crawlerPatchArgs,
  readableRows,
  requireWritableBackend,
  selectBackend,
  setEntityBackendAuthState,
  WritesBlockedOffline,
} from '../entityBackend'

/**
 * Backend selection (ADR-030 §1, ADR-034 decision 1).
 *
 * Three answers, two of them refusals: `signedOut` for anybody not signed
 * in (read-only, and reads nothing), `remote` for a Connected session, `blocked` while Disconnected or still
 * settling the auth handshake. The `local` backend — durable IndexedDB for an
 * anonymous visitor in a build with the account gate off — is retired, and the
 * tests below pin that it cannot come back through any combination of inputs.
 *
 * The test build has no `VITE_CONVEX_URL`, so `convexClient` is null. That is
 * the configuration CI and a fresh checkout run in, and it is now anonymous
 * whatever the auth state claims.
 */

afterEach(() => {
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('a build with no Convex URL is always anonymous', () => {
  test('signed out', () => {
    setEntityBackendAuthState({ signedIn: false, online: true })
    expect(selectBackend()).toBe('signedOut')
  })

  test('even when the auth state claims signed in', () => {
    // There is no client to talk to, so "signed in" cannot be true in any
    // meaningful sense. Resolving to remote here would strand every write.
    setEntityBackendAuthState({ signedIn: true, online: true })
    expect(selectBackend()).toBe('signedOut')
  })

  test('even when offline', () => {
    setEntityBackendAuthState({ signedIn: true, online: false })
    expect(selectBackend()).toBe('signedOut')
  })
})

describe('an unsettled auth handshake cannot block a build with no auth layer', () => {
  test('with no handshake to wait for, it is refused as signed out, not as settling', () => {
    // `authSettled: false` is what ConnectionProvider pushes for the first few
    // hundred ms of a signed-in load — but with no Convex URL there is no
    // handshake to wait for, so the refusal says "sign in", not "try again".
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: false })
    expect(selectBackend()).toBe('signedOut')
    expect(refusalReason()).toBe('signedOut')
  })

  test('an omitted authSettled is treated as settled', () => {
    setEntityBackendAuthState({ signedIn: false, online: true })
    expect(selectBackend()).toBe('signedOut')
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
  test('a configured, settled, online, signed-in session is remote', () => {
    // What `withSignedInBackend()` pushes. If this stopped resolving to
    // `remote`, every durability test would quietly start asserting against
    // the signed-out backend instead.
    setEntityBackendAuthState({
      signedIn: true,
      online: true,
      authSettled: true,
      convexConfigured: true,
    })
    expect(selectBackend()).toBe('remote')
    expect(requireWritableBackend()).toBe('remote')
  })

  test('the same session offline is blocked, with the offline reason', () => {
    setEntityBackendAuthState({
      signedIn: true,
      online: false,
      authSettled: true,
      convexConfigured: true,
    })
    expect(selectBackend()).toBe('blocked')
    expect(() => requireWritableBackend()).toThrow(WritesBlockedOffline)
  })

  test('mid-handshake is blocked with the settling reason', () => {
    setEntityBackendAuthState({
      signedIn: false,
      online: true,
      authSettled: false,
      convexConfigured: true,
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
      convexConfigured: true,
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

describe('readableRows — what a store may show', () => {
  /** A cache that records whether it was read. */
  function cache() {
    const read = { count: 0 }
    return {
      read,
      list: async () => {
        read.count += 1
        return [{ id: 'on-disk' }]
      },
    }
  }

  test('signed out shows nothing, and does not even read the cache', async () => {
    // The cache may still hold the last account's rows.
    const c = cache()
    expect(await readableRows(c)).toEqual([])
    expect(c.read.count).toBe(0)
  })

  test('signed in, or blocked, shows the cache', async () => {
    setEntityBackendAuthState({
      signedIn: true,
      online: true,
      authSettled: true,
      convexConfigured: true,
    })
    expect(await readableRows(cache())).toEqual([{ id: 'on-disk' }])
    // Disconnected is read-only, not blind: what was pulled down stays open.
    setEntityBackendAuthState({
      signedIn: true,
      online: false,
      authSettled: true,
      convexConfigured: true,
    })
    expect(selectBackend()).toBe('blocked')
    expect(await readableRows(cache())).toEqual([{ id: 'on-disk' }])
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
