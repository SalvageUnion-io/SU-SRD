import { afterEach, describe, expect, test } from 'bun:test'
import { CONNECTION_MODES } from '../../lib/connection/connectionMode'
import {
  backendForMode,
  requireWritableBackend,
  selectBackend,
  setEntityBackendAuthState,
  WritesBlockedOffline,
} from '../entityBackend'

/**
 * Backend selection (ADR-030 §1, ADR-034 decision 1).
 *
 * Two durable-or-not answers and one refusal: `memory` for anybody not signed
 * in, `remote` for a Connected session, `blocked` while Disconnected or still
 * settling the auth handshake. The `local` backend — durable IndexedDB for an
 * anonymous visitor in a build with the account gate off — is retired, and the
 * tests below pin that it cannot come back through any combination of inputs.
 *
 * The test build has no `VITE_CONVEX_URL`, so `convexClient` is null. That is
 * the configuration CI and a fresh checkout run in, and it is now anonymous and
 * in-memory whatever the auth state claims.
 */

afterEach(() => {
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('a build with no Convex URL is always anonymous, and anonymous is memory', () => {
  test('signed out', () => {
    setEntityBackendAuthState({ signedIn: false, online: true })
    expect(selectBackend()).toBe('memory')
  })

  test('even when the auth state claims signed in', () => {
    // There is no client to talk to, so "signed in" cannot be true in any
    // meaningful sense. Resolving to remote here would strand every write.
    setEntityBackendAuthState({ signedIn: true, online: true })
    expect(selectBackend()).toBe('memory')
  })

  test('even when offline', () => {
    setEntityBackendAuthState({ signedIn: true, online: false })
    expect(selectBackend()).toBe('memory')
  })
})

describe('an unsettled auth handshake cannot block a build with no auth layer', () => {
  test('still memory, and still writable', () => {
    // `authSettled: false` is what ConnectionProvider pushes for the first few
    // hundred ms of a signed-in load — but with no Convex URL there is no
    // handshake to wait for, and blocking here would make every anonymous
    // write in CI throw.
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: false })
    expect(selectBackend()).toBe('memory')
    expect(requireWritableBackend()).toBe('memory')
  })

  test('an omitted authSettled is treated as settled', () => {
    setEntityBackendAuthState({ signedIn: false, online: true })
    expect(selectBackend()).toBe('memory')
  })
})

describe('an anonymous write is never refused', () => {
  test('requireWritableBackend returns memory rather than throwing, even offline', () => {
    // Offline + signed out is Solo, not Disconnected. The account is required
    // to KEEP work, never to do it (ADR-034 decision 1).
    setEntityBackendAuthState({ signedIn: false, online: false, authSettled: true })
    expect(requireWritableBackend()).toBe('memory')
  })
})

describe('the signed-in backend the durability tests run on', () => {
  test('a configured, settled, online, signed-in session is remote', () => {
    // What `withSignedInBackend()` pushes. If this stopped resolving to
    // `remote`, every durability test would quietly start asserting against
    // the memory backend instead.
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
    expect(backendForMode('solo')).toBe('memory')
    expect(backendForMode('connected')).toBe('remote')
    expect(backendForMode('disconnected')).toBe('blocked')
    expect(backendForMode('connecting')).toBe('blocked')
  })

  test('there is no input that yields a durable anonymous backend', () => {
    // The rule takes the mode and nothing else. The build flag
    // (`VITE_REQUIRE_ACCOUNT`) and the legacy-roster probe it once also read are
    // both gone, which makes a `local` comeback unwritable rather than merely
    // unwritten: there is no argument left to pass it through.
    expect(backendForMode.length).toBe(1)
    for (const mode of CONNECTION_MODES) {
      expect(['remote', 'blocked', 'memory']).toContain(backendForMode(mode))
    }
  })

  test('a pre-account roster is migrated, not served', () => {
    // Stated here because this is the test somebody will read when they wonder
    // whether retiring `local` stranded existing players. It did not: the rows
    // stay in IndexedDB, `AccountReconciler` offers sign-in-or-download while
    // signed out, and moves them into the account on sign-in.
    // See `lib/account/__tests__/legacyMigration.test.ts`.
    expect(backendForMode('solo')).toBe('memory')
    expect(backendForMode('connected')).toBe('remote')
  })
})
