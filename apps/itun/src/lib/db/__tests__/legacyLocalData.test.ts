/**
 * The pre-account roster probe, and the read that migrates it (ADR-035).
 *
 * The probe says whether there is anything left to move into the account, and
 * `markLegacyLocalDataMigrated` is what finally — and durably — answers "no".
 * It reads the cache's recorded origin (`cacheMeta.ts`) rather than counting
 * rows: a signed-in browser's cache is full of rows, and counting them is how
 * every load re-claimed builds deleted on another device.
 *
 * Runs against `fake-indexeddb` (preloaded via `bunfig.toml`), so these are real
 * IndexedDB reads rather than a stubbed answer.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { crawlerFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import * as db from '../index'
import {
  _resetLegacyProbe,
  legacyLocalDataState,
  markLegacyLocalDataMigrated,
  probeLegacyLocalData,
  readLegacyLocalData,
} from '../legacyLocalData'

beforeEach(async () => {
  await db.clearCache()
  _resetLegacyProbe()
})

/**
 * **Reset on the way out, not only on the way in.**
 *
 * The probe caches its answer in a module-level variable, and Bun runs a
 * workspace's test files in ONE process — so a resolved answer here is the
 * answer every file that runs afterwards sees. The blast radius is smaller than
 * it was, now that nothing selects a backend from it, but `mayPrune` still reads
 * it: leaving it `absent` arms `ShelfSync`'s prune for every later file.
 *
 * Same discipline as `mock.module` in `.claude/rules/testing-patterns.md`:
 * process-global state is the caller's to put back.
 */
afterAll(() => {
  _resetLegacyProbe()
})

/** Record the browser as holding a pre-account roster, as the v18 upgrade does. */
async function markLegacy(): Promise<void> {
  await db.writeCacheMeta({ origin: 'legacy', userId: null })
}

describe('an empty browser', () => {
  test('reports absent: there is nothing to migrate', async () => {
    expect(await probeLegacyLocalData()).toBe('absent')
  })
})

describe('a browser recorded as holding a roster', () => {
  test('reports present', async () => {
    await markLegacy()
    await db.pilots.put(pilotFixture({ id: 'legacy-1' }))
    expect(await probeLegacyLocalData()).toBe('present')
  })
})

describe('a signed-in cache full of rows', () => {
  test('reports absent: its rows are the account’s, not a roster to migrate', async () => {
    // The defect this replaced: the probe counted rows, so the cache `ShelfSync`
    // filled read as a roster on every load, and a cached build deleted on
    // another device was claimed straight back into the account.
    await db.writeCacheMeta({ origin: 'cache', userId: 'user-a' })
    await db.pilots.put(pilotFixture({ id: 'cached-1' }))
    await db.crawlers.put(crawlerFixture({ id: 'cached-c' }))
    expect(await probeLegacyLocalData()).toBe('absent')
  })
})

describe('the state it exposes', () => {
  test('is unknown until the probe runs', () => {
    // `mayPrune` refuses on `unknown` for the same reason it refuses on
    // `present`: the question "can absence from `listMine` be trusted to mean
    // deleted?" has not been answered yet.
    expect(legacyLocalDataState()).toBe('unknown')
  })

  test('is remembered, so the answer is stable across calls', async () => {
    await markLegacy()
    await probeLegacyLocalData()
    expect(legacyLocalDataState()).toBe('present')

    // The disk changing underneath must NOT flip the answer by itself. Only a
    // completed migration closes the window, and it says so explicitly.
    await db.writeCacheMeta({ origin: 'cache', userId: null })
    expect(await probeLegacyLocalData()).toBe('present')
  })

  test('a completed migration is what closes it, and the close outlives the page', async () => {
    // The window ADR-034 said would close "per browser rather than on a date"
    // never closed, because nothing ever set this — and once something did, it
    // set a module variable the next load forgot.
    await markLegacy()
    await db.pilots.put(pilotFixture({ id: 'legacy-3' }))
    await probeLegacyLocalData()
    expect(legacyLocalDataState()).toBe('present')

    await markLegacyLocalDataMigrated('user-a')
    expect(legacyLocalDataState()).toBe('absent')

    // A fresh page load asks again, and the answer is on disk now.
    _resetLegacyProbe()
    expect(await probeLegacyLocalData()).toBe('absent')
    expect(await db.readCacheMeta()).toEqual({ origin: 'cache', userId: 'user-a' })
  })
})

describe('concurrent and stale probes', () => {
  test('two callers at boot share one probe', async () => {
    // `ConnectionProvider` and `AccountReconciler` both ask on mount.
    const first = probeLegacyLocalData()
    const second = probeLegacyLocalData()
    expect(second).toBe(first)
    expect(await first).toBe('absent')
  })

  test('a probe started before a reset cannot write over the fresh answer', async () => {
    // Started against an empty browser, then overtaken: the reset, a roster
    // arriving, and a new probe. The old run must not land its stale `absent`
    // on top — that is what arms the prune against a roster nobody migrated.
    const stale = probeLegacyLocalData()
    _resetLegacyProbe()
    await markLegacy()

    await stale
    expect(await probeLegacyLocalData()).toBe('present')
    expect(legacyLocalDataState()).toBe('present')
  })

  test('a migration finished mid-probe is not reopened by the probe', async () => {
    await markLegacy()
    const running = probeLegacyLocalData()
    const closing = markLegacyLocalDataMigrated('user-a')
    expect(await running).toBe('absent')
    await closing
  })
})

describe('reading the roster out', () => {
  test('returns every kind a claim accepts', async () => {
    // A partial read is how the first `claimLocal` dropped the crawler and the
    // pattern library — a player watched half a campaign not arrive. The shape
    // is asserted rather than the contents so a new kind cannot be added to the
    // claim and forgotten here.
    await db.pilots.put(pilotFixture({ id: 'legacy-p' }))
    await db.crawlers.put(crawlerFixture({ id: 'legacy-c' }))

    const rows = await readLegacyLocalData()

    expect(Object.keys(rows).sort()).toEqual([
      'crawlers',
      'encounterNpcs',
      'mechPatterns',
      'mechs',
      'pilots',
      'softLinks',
    ])
    expect(rows.pilots).toHaveLength(1)
    expect(rows.crawlers).toHaveLength(1)
    expect(rows.mechs).toHaveLength(0)
  })

  test('reads IndexedDB, not the store — an empty account is not an empty device', async () => {
    // The failure the old claim card had: it counted the entity store, which for
    // a signed-in player is filled from the SERVER. Once a sync had run it read a
    // full account, found nothing to offer, and rendered nothing while the local
    // rows sat untouched beside it.
    await db.pilots.put(pilotFixture({ id: 'legacy-only' }))
    const rows = await readLegacyLocalData()
    expect((rows.pilots[0] as { id: string }).id).toBe('legacy-only')
  })
})
