import { afterEach, describe, expect, test } from 'bun:test'
import {
  backendForMode,
  requireWritableBackend,
  selectBackend,
  setEntityBackendAuthState,
  WritesBlockedOffline,
} from '../entityBackend'

/**
 * Backend selection (ADR-030 §1).
 *
 * The asymmetry in these tests is intentional. Choosing `remote` when the
 * answer should be `local` costs a Solo user their writes — silently, because
 * there is no server listening for them. Choosing `local` when the answer is
 * `remote` merely delays a sync. So the cases below lean hardest on proving
 * that **local is the default and every uncertain state resolves to it**.
 *
 * The test build has no `VITE_CONVEX_URL`, so `convexClient` is null and every
 * outcome here is `local` regardless of auth state — which is itself the
 * property worth pinning, because that is the configuration CI and every
 * unmigrated contributor runs in.
 */

afterEach(() => {
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('a build with no Convex URL is always local', () => {
  test('signed out', () => {
    setEntityBackendAuthState({ signedIn: false, online: true })
    expect(selectBackend()).toBe('local')
  })

  test('even when the auth state claims signed in', () => {
    // There is no client to talk to, so "signed in" cannot be true in any
    // meaningful sense. Resolving to remote here would strand every write.
    setEntityBackendAuthState({ signedIn: true, online: true })
    expect(selectBackend()).toBe('local')
  })

  test('even when offline', () => {
    setEntityBackendAuthState({ signedIn: true, online: false })
    expect(selectBackend()).toBe('local')
  })
})

describe('an unsettled auth handshake cannot make a Solo build blocked', () => {
  test('still local, and still writable', () => {
    // This is the guard on the handshake fix. `authSettled: false` is what
    // ConnectionProvider pushes for the first few hundred ms of a signed-in
    // load — but with no Convex URL there is no handshake to wait for, and
    // blocking here would break CI and every unmigrated contributor.
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: false })
    expect(selectBackend()).toBe('local')
    expect(requireWritableBackend()).toBe('local')
  })

  test('an omitted authSettled is treated as settled', () => {
    // Back-compat for any caller predating the field: absence must not mean
    // "blocked", because the absent case is a build with no auth layer at all.
    setEntityBackendAuthState({ signedIn: false, online: true })
    expect(selectBackend()).toBe('local')
  })
})

describe('writes are never blocked in a Solo build', () => {
  test('requireWritableBackend returns local rather than throwing', () => {
    setEntityBackendAuthState({ signedIn: false, online: false, authSettled: true })
    // Offline + signed out is Solo, not Disconnected. A person who never
    // signed in has nothing to be disconnected FROM, and refusing their write
    // would break the app for the majority of users.
    expect(requireWritableBackend()).toBe('local')
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

/**
 * The anonymous backend (ADR-034 decision 1, plan phase P2).
 *
 * Driven through `backendForMode` rather than `selectBackend`, because the
 * account-required switch is a build-time `import.meta.env` read that a test
 * cannot vary — the same reason `resolveConnectionMode` is a pure function
 * beside `useConnection`.
 */
describe('a build that requires an account gives an anonymous visitor nothing durable', () => {
  test('solo becomes memory when the flag is on', () => {
    expect(backendForMode('solo', true)).toBe('memory')
  })

  test('solo stays local when the flag is off', () => {
    // `VITE_REQUIRE_ACCOUNT=false` is the escape hatch a deploy would need if
    // the flip turned out to be wrong in a way the tests did not catch.
    expect(backendForMode('solo', false)).toBe('local')
  })

  test('the flag changes nothing for a signed-in user', () => {
    // Requiring an account has no opinion about somebody who has one. If these
    // diverged, turning the gate on would change where signed-in writes go,
    // which belongs to the demotion and must not ride along with the flip.
    for (const flag of [true, false]) {
      expect(backendForMode('connected', flag)).toBe('remote')
      expect(backendForMode('disconnected', flag)).toBe('blocked')
      expect(backendForMode('connecting', flag)).toBe('blocked')
    }
  })
})

describe('a pre-account roster no longer buys an exemption (ADR-035)', () => {
  test('the flag alone decides, whatever this browser is holding', () => {
    // The exemption this replaces read a probe that NOTHING ever resolved to
    // `absent`, so it did not open a migration window — it made the durable
    // local backend permanent for anybody who had ever built anything, and that
    // is the second source of truth ADR-035 removes. `backendForMode` no longer
    // takes the probe at all, which is what makes the regression unwritable
    // rather than merely unwritten.
    expect(backendForMode('solo', true)).toBe('memory')
    expect(backendForMode.length).toBe(2)
  })

  test('their roster is migrated, not abandoned', () => {
    // Stated here because this is the test somebody will read when they wonder
    // whether removing the guard stranded existing players. It did not: the rows
    // stay in IndexedDB, `LegacyLocalData` offers sign-in-or-download while
    // signed out, and `selectStranded` moves them into the account on sign-in.
    // See `lib/account/__tests__/legacyMigration.test.ts`.
    expect(backendForMode('connected', true)).toBe('remote')
  })

  test('selectBackend agrees — this build does not require an account', () => {
    // End to end through the real wiring rather than the pure function. The test
    // build has no `VITE_REQUIRE_ACCOUNT`, so the live selector stays `local`.
    expect(selectBackend()).toBe('local')
  })
})
