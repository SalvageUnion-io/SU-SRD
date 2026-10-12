/**
 * The old IndexedDB cache is deleted at boot, and a failure never throws.
 */

import { describe, expect, test } from 'bun:test'
import { deleteLegacyCache } from '../legacyCache'

/** An `indexedDB` stand-in that records the names it was asked to delete. */
function fakeFactory(behaviour: 'ok' | 'throws' = 'ok') {
  const deleted: string[] = []
  const requests: { onerror: (() => void) | null; error: Error | null }[] = []
  return {
    deleted,
    requests,
    deleteDatabase(name: string) {
      if (behaviour === 'throws') throw new Error('SecurityError')
      deleted.push(name)
      const request = { onerror: null, error: new Error('failed') }
      requests.push(request)
      return request as unknown as IDBOpenDBRequest
    },
  }
}

describe('deleteLegacyCache', () => {
  test('deletes the itun-v1 database', () => {
    const idb = fakeFactory()
    deleteLegacyCache(idb)
    expect(idb.deleted).toEqual(['itun-v1'])
  })

  test('swallows a synchronous throw and a failed request', () => {
    const throwing = fakeFactory('throws')
    expect(() => deleteLegacyCache(throwing)).not.toThrow()

    const failing = fakeFactory()
    deleteLegacyCache(failing)
    expect(() => failing.requests[0]?.onerror?.()).not.toThrow()
  })

  test('does nothing where there is no indexedDB', () => {
    expect(() => deleteLegacyCache(undefined)).not.toThrow()
  })
})
