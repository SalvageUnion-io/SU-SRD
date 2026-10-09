/**
 * The meta row: whose rows this browser's cache holds (`cacheMeta.ts`).
 */

import { describe, expect, test } from 'bun:test'
import { CACHE_META_ID, cacheMetaRecord, parseCacheMeta } from '../cacheMeta'

describe('reading it back', () => {
  test('a missing row is a cache that belongs to nobody', () => {
    expect(parseCacheMeta(undefined)).toEqual({ userId: null })
  })

  test('a stored owner is read back', () => {
    expect(parseCacheMeta({ id: CACHE_META_ID, userId: 'u1' })).toEqual({ userId: 'u1' })
  })

  test('an unreadable owner belongs to nobody', () => {
    expect(parseCacheMeta({ userId: 7 })).toEqual({ userId: null })
  })
})

describe('the stored row', () => {
  test('is keyed by the one fixed id', () => {
    expect(cacheMetaRecord({ userId: 'u1' })).toEqual({ id: CACHE_META_ID, userId: 'u1' })
  })
})
