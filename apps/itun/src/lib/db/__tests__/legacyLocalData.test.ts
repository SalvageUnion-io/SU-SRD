/**
 * The pre-account roster probe, and the read that migrates it (ADR-035).
 *
 * The probe used to choose a BACKEND — a `present` answer kept the durable local
 * store alive indefinitely. It no longer does: it says whether there is anything
 * left to move into the account, and `markLegacyLocalDataMigrated` is what
 * finally answers "no".
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
  await db._clearAllStores()
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

describe('an empty browser', () => {
  test('reports absent, which is what lets a new visitor work in memory', async () => {
    expect(await probeLegacyLocalData()).toBe('absent')
  })
})

describe('a browser with a roster', () => {
  test('one pilot is enough to report present', async () => {
    await db.pilots.put(pilotFixture({ id: 'legacy-1' }))
    expect(await probeLegacyLocalData()).toBe('present')
  })

  test('a crawler alone counts too — it is not just the pilots store', async () => {
    // The probe has to look past `pilots`: somebody whose only local build is a
    // crawler has just as much to lose, and checking one store would strand them
    // while cheerfully reporting 'absent'.
    await db.crawlers.put(crawlerFixture({ id: 'legacy-crawler' }))
    expect(await probeLegacyLocalData()).toBe('present')
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
    await db.pilots.put(pilotFixture({ id: 'legacy-2' }))
    await probeLegacyLocalData()
    expect(legacyLocalDataState()).toBe('present')

    // Clearing the store afterwards must NOT flip the answer back by itself.
    // Only a completed migration closes the window, and it says so explicitly.
    await db._clearAllStores()
    expect(await probeLegacyLocalData()).toBe('present')
  })

  test('a completed migration is what closes it — nothing else does', async () => {
    // The window ADR-034 said would close "per browser rather than on a date"
    // never closed, because nothing ever set this. That is the whole reason a
    // roster could sit on a device forever, invisible to the account.
    await db.pilots.put(pilotFixture({ id: 'legacy-3' }))
    await probeLegacyLocalData()
    expect(legacyLocalDataState()).toBe('present')

    markLegacyLocalDataMigrated()
    expect(legacyLocalDataState()).toBe('absent')
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
