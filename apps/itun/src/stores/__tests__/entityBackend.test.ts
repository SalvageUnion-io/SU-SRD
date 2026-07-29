import { afterEach, describe, expect, test } from 'bun:test'

import {
  WritesBlockedOffline,
  requireWritableBackend,
  selectBackend,
  setEntityBackendAuthState,
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
  setEntityBackendAuthState({ signedIn: false, online: true })
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

describe('writes are never blocked in a Solo build', () => {
  test('requireWritableBackend returns local rather than throwing', () => {
    setEntityBackendAuthState({ signedIn: false, online: false })
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
})
