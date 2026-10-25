/**
 * The sync status and the write rule it carries (`sync.ts`): one status, and a
 * write goes up only `live` and not outdated.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import type { SyncInputs, SyncStatus } from '../sync'
import {
  isSignedIn,
  requireWritable,
  resetSync,
  SYNC_STATUSES,
  setSyncStatus,
  subscribeSync,
  syncStatusOf,
  WritesBlockedOffline,
  writable,
} from '../sync'

afterEach(() => {
  resetSync()
})

const inputs = (over: Partial<SyncInputs>): SyncInputs => ({
  authSettled: true,
  signedIn: false,
  online: true,
  storedSession: false,
  ...over,
})

describe('syncStatusOf', () => {
  test('a settled, online session is live', () => {
    expect(syncStatusOf(inputs({ signedIn: true }))).toBe('live')
  })

  test('signed out is signed out, online or off', () => {
    expect(syncStatusOf(inputs({}))).toBe('signedOut')
    expect(syncStatusOf(inputs({ online: false }))).toBe('signedOut')
  })

  test('still finding out is syncing', () => {
    expect(syncStatusOf(inputs({ authSettled: false }))).toBe('syncing')
  })

  test('signed in with no network is offline', () => {
    expect(syncStatusOf(inputs({ signedIn: true, online: false }))).toBe('offline')
  })

  test('booted offline with a session on the device is offline at once', () => {
    // The handshake can never settle without a network.
    expect(syncStatusOf(inputs({ authSettled: false, online: false, storedSession: true }))).toBe(
      'offline'
    )
    expect(syncStatusOf(inputs({ authSettled: false, online: false }))).toBe('syncing')
  })

  test('only live and offline hold a session', () => {
    expect(SYNC_STATUSES.filter(isSignedIn)).toEqual(['live', 'offline'])
  })
})

describe('a write', () => {
  const reasonFor = (status: SyncStatus, outdated = false): string | null => {
    setSyncStatus(status, outdated)
    try {
      requireWritable()
      return null
    } catch (err) {
      return (err as WritesBlockedOffline).reason
    }
  }

  test('goes up only live', () => {
    expect(reasonFor('live')).toBeNull()
    expect(writable()).toBe(true)
  })

  test('is refused with the reason each status has', () => {
    expect(reasonFor('signedOut')).toBe('signedOut')
    expect(reasonFor('syncing')).toBe('settling')
    expect(reasonFor('offline')).toBe('offline')
    expect(reasonFor('live', true)).toBe('outdated')
    expect(writable()).toBe(false)
  })

  test('refused, says the act and not the condition', () => {
    const err = new WritesBlockedOffline('offline')
    expect(err.message).toBe('That change was not saved: your Games are read-only for now.')
    expect(err.name).toBe('WritesBlockedOffline')
    expect(new WritesBlockedOffline('settling').message).toMatch(/still signing in/i)
  })
})

describe('subscribeSync', () => {
  test('hears each change until it unsubscribes', () => {
    let heard = 0
    const stop = subscribeSync(() => {
      heard += 1
    })
    setSyncStatus('live')
    setSyncStatus('live')
    setSyncStatus('offline')
    stop()
    setSyncStatus('live')
    expect(heard).toBe(2)
  })
})
