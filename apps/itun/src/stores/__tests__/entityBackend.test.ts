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
  test('solo becomes memory when the flag is on and the browser is empty', () => {
    expect(backendForMode('solo', true, 'absent')).toBe('memory')
  })

  test('solo stays local when the flag is off', () => {
    // `VITE_REQUIRE_ACCOUNT=false` is the escape hatch a deploy would need if
    // the flip turned out to be wrong in a way the tests did not catch.
    expect(backendForMode('solo', false, 'absent')).toBe('local')
  })

  test('the flag changes nothing for a signed-in user', () => {
    // Requiring an account has no opinion about somebody who has one. If these
    // diverged, turning the gate on would change where signed-in writes go,
    // which belongs to the demotion and must not ride along with the flip.
    for (const flag of [true, false]) {
      for (const legacy of ['unknown', 'present', 'absent'] as const) {
        expect(backendForMode('connected', flag, legacy)).toBe('remote')
        expect(backendForMode('disconnected', flag, legacy)).toBe('blocked')
        expect(backendForMode('connecting', flag, legacy)).toBe('blocked')
      }
    }
  })
})

describe('the legacy-roster guard on the flip', () => {
  test('an existing roster keeps the local backend, flag or no flag', () => {
    // The whole point of the guard. Sending an existing Solo user to the memory
    // backend makes their pilots UNREACHABLE — not deleted, but from where they
    // sit that is the same thing. P5's claim card cannot rescue them either: it
    // reads the entity store, which in memory mode is empty, so there would be
    // nothing to offer and no way to know there was anything to ask for.
    expect(backendForMode('solo', true, 'present')).toBe('local')
  })

  test('an UNRESOLVED probe keeps the local backend — the safe side', () => {
    // The probe is async and `selectBackend()` is not, so there is a window at
    // boot where the answer is unknown. Guessing 'absent' wrongly sends an
    // existing user's writes to a Map that dies with the tab; guessing 'present'
    // wrongly gives a new visitor a durable write they were going to be asked to
    // claim anyway. Only one of those loses work, so the window resolves toward
    // the other one.
    expect(backendForMode('solo', true, 'unknown')).toBe('local')
  })

  test('omitting the probe argument never picks memory', () => {
    // A caller that forgets the third argument must not accidentally opt into
    // the destructive branch, so it defaults to 'unknown' rather than 'absent'.
    expect(backendForMode('solo', true)).toBe('local')
  })

  test('selectBackend agrees — the probe has not run in this test process', () => {
    // End to end through the real wiring rather than the pure function: with no
    // probe performed, the live selector must also refuse the memory branch.
    expect(selectBackend()).toBe('local')
  })
})
