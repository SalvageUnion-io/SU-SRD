/**
 * No IndexedDB store without a Convex commit seam (ADR-034, ADR-035).
 *
 * IndexedDB is the account's cache of Convex, so every object store this
 * database holds must name the commit that writes its rows to the server of
 * record. A store that maps to none persists only on a device, which is a
 * defect: give it a Convex table and a seam (`entityStore`'s `commitWrite`, or
 * the required `commit` on `makeHydratedCollectionSlice`) before adding it.
 *
 * Two stores carry no records of their own and are named for what they are:
 * `meta` describes the cache (whose rows, and where they came from), and
 * `workspaces` is the retired container: only the v10 and v13 migrations on
 * the upgrade ladder touch it, and it stays only so they run (#1152).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { deleteDB } from 'idb'
import {
  commitEntityWrite,
  commitNpcWrite,
  commitPatternWrite,
  commitSoftLink,
} from '../../../stores/entityBackend'
import * as itunDb from '../index'
import type { StoreName } from '../stores'
import { STORE_NAMES } from '../stores'

type Seam =
  | { kind: 'convex'; commit: (...args: never[]) => Promise<void> }
  | { kind: 'cacheMeta' }
  | { kind: 'retired' }

const SEAMS = {
  // entityStore's commitWrite
  pilots: { kind: 'convex', commit: commitEntityWrite },
  mechs: { kind: 'convex', commit: commitEntityWrite },
  crawlers: { kind: 'convex', commit: commitEntityWrite },
  softLinks: { kind: 'convex', commit: commitSoftLink },
  // makeHydratedCollectionSlice's commit
  mechPatterns: { kind: 'convex', commit: commitPatternWrite },
  encounterNpcs: { kind: 'convex', commit: commitNpcWrite },
  meta: { kind: 'cacheMeta' },
  workspaces: { kind: 'retired' },
} satisfies Record<StoreName, Seam>

const seams: Readonly<Record<string, Seam>> = SEAMS

/** The store names in `names` that map to no seam. */
function unmapped(names: Iterable<string>): string[] {
  return [...names].filter((name) => !Object.hasOwn(seams, name))
}

const TEST_DB = 'itun-store-seams-test'

afterEach(async () => {
  await deleteDB(TEST_DB)
})

describe('every IndexedDB store has a Convex commit seam', () => {
  test('every STORE_NAMES entry is mapped', () => {
    expect(unmapped(Object.values(STORE_NAMES))).toEqual([])
  })

  test('every object store a fresh database creates is mapped', async () => {
    const db = await itunDb.openItunDatabase(TEST_DB)
    try {
      expect(unmapped(db.objectStoreNames)).toEqual([])
    } finally {
      db.close()
    }
  })

  test('a store with no seam is refused (negative control)', () => {
    expect(unmapped([STORE_NAMES.pilots, 'deviceOnlyDrafts'])).toEqual(['deviceOnlyDrafts'])
  })

  test('the retired workspaces store has no CRUD surface', () => {
    expect(itunDb).not.toHaveProperty(STORE_NAMES.workspaces)
  })
})
