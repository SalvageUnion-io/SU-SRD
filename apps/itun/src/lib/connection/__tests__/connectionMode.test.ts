import { describe, expect, test } from 'bun:test'
import type { ConnectionInputs } from '../connectionMode'
import {
  isSettlingConnection,
  resolveConnectionMode,
  shouldWarnDisconnected,
  usesServerOfRecord,
  writesAllowed,
} from '../connectionMode'

/**
 * The mode table is small enough to test exhaustively, so it is — all eight
 * settled input combinations, named by what they mean rather than by their
 * booleans, plus the unsettled window below. A regression here is a regression
 * in ADR-030's central promise.
 */

function inputs(over: Partial<ConnectionInputs> = {}): ConnectionInputs {
  return { convexConfigured: true, authSettled: true, signedIn: true, online: true, ...over }
}

describe('resolveConnectionMode — all eight combinations', () => {
  const cases: Array<{ name: string; over: Partial<ConnectionInputs>; expected: string }> = [
    { name: 'configured + signed in + online', over: {}, expected: 'connected' },
    {
      name: 'configured + signed in + offline',
      over: { online: false },
      expected: 'disconnected',
    },
    { name: 'configured + signed out + online', over: { signedIn: false }, expected: 'solo' },
    {
      name: 'configured + signed out + offline',
      over: { signedIn: false, online: false },
      expected: 'solo',
    },
    {
      name: 'unconfigured + signed in + online',
      over: { convexConfigured: false },
      expected: 'solo',
    },
    {
      name: 'unconfigured + signed in + offline',
      over: { convexConfigured: false, online: false },
      expected: 'solo',
    },
    {
      name: 'unconfigured + signed out + online',
      over: { convexConfigured: false, signedIn: false },
      expected: 'solo',
    },
    {
      name: 'unconfigured + signed out + offline',
      over: { convexConfigured: false, signedIn: false, online: false },
      expected: 'solo',
    },
  ]

  for (const c of cases) {
    test(`${c.name} -> ${c.expected}`, () => {
      expect(resolveConnectionMode(inputs(c.over))).toBe(c.expected as never)
    })
  }
})

describe('the unsettled auth handshake is its own mode, not Solo', () => {
  test('configured + still settling -> connecting, whatever signedIn says', () => {
    // `isAuthenticated` is false for the whole initial handshake, so reading it
    // alone made this window indistinguishable from a signed-out user — and Solo
    // routes writes to IndexedDB with the mirror switched off.
    expect(resolveConnectionMode(inputs({ authSettled: false, signedIn: false }))).toBe(
      'connecting'
    )
    expect(resolveConnectionMode(inputs({ authSettled: false, signedIn: true }))).toBe('connecting')
  })

  test('a build with no Convex URL never reaches connecting', () => {
    // There is no auth layer to wait for. CI and a fresh checkout stay Solo, and
    // their writes are never refused.
    expect(resolveConnectionMode(inputs({ convexConfigured: false, authSettled: false }))).toBe(
      'solo'
    )
  })

  test('connecting refuses writes but does not raise the alarm', () => {
    // Refusing is the point: a write let through here lands locally and is never
    // mirrored. Warning is not — this window closes in well under a second, and
    // a NOT CONNECTED banner on every load would be a lie with a short fuse.
    expect(writesAllowed('connecting')).toBe(false)
    expect(shouldWarnDisconnected('connecting')).toBe(false)
    expect(isSettlingConnection('connecting')).toBe(true)
    expect(usesServerOfRecord('connecting')).toBe(false)
  })

  test('no other mode reports itself as settling', () => {
    expect(isSettlingConnection('solo')).toBe(false)
    expect(isSettlingConnection('connected')).toBe(false)
    expect(isSettlingConnection('disconnected')).toBe(false)
  })
})

describe('Solo is not Disconnected', () => {
  test('a signed-out user offline is Solo, never Disconnected', () => {
    // The whole point: someone who never signed in is not "offline", they are
    // using the app exactly as it worked before accounts existed.
    const mode = resolveConnectionMode(inputs({ signedIn: false, online: false }))
    expect(mode).toBe('solo')
    expect(writesAllowed(mode)).toBe(true)
    expect(shouldWarnDisconnected(mode)).toBe(false)
  })

  test('only a signed-in user can reach Disconnected', () => {
    expect(resolveConnectionMode(inputs({ signedIn: true, online: false }))).toBe('disconnected')
    expect(resolveConnectionMode(inputs({ signedIn: false, online: false }))).toBe('solo')
  })

  test('a build with no Convex URL is permanently Solo, not broken', () => {
    // CI and a contributor who has not run `convex dev` both land here.
    expect(resolveConnectionMode(inputs({ convexConfigured: false }))).toBe('solo')
    expect(writesAllowed('solo')).toBe(true)
  })
})

describe('writesAllowed', () => {
  test('blocks only in disconnected', () => {
    expect(writesAllowed('solo')).toBe(true)
    expect(writesAllowed('connected')).toBe(true)
    expect(writesAllowed('disconnected')).toBe(false)
  })
})

describe('shouldWarnDisconnected', () => {
  test('warns only in disconnected', () => {
    expect(shouldWarnDisconnected('solo')).toBe(false)
    expect(shouldWarnDisconnected('connected')).toBe(false)
    expect(shouldWarnDisconnected('disconnected')).toBe(true)
  })
})

describe('usesServerOfRecord', () => {
  test('only connected reads through Convex', () => {
    expect(usesServerOfRecord('connected')).toBe(true)
    expect(usesServerOfRecord('solo')).toBe(false)
    // Disconnected reads the cache, so it must NOT be treated as server-backed.
    expect(usesServerOfRecord('disconnected')).toBe(false)
  })
})
