/**
 * The legacy-roster probe — the guard that makes the account-required flip safe
 * for people who were already here.
 *
 * Runs against `fake-indexeddb` (preloaded via `bunfig.toml`), so these are real
 * IndexedDB reads rather than a stubbed answer.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { crawlerFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import * as db from '../index'
import { _resetLegacyProbe, legacyLocalDataState, probeLegacyLocalData } from '../legacyLocalData'

beforeEach(async () => {
  await db._clearAllStores()
  _resetLegacyProbe()
})

/**
 * **Reset on the way out, not only on the way in.**
 *
 * The probe caches its answer in a module-level variable, and Bun runs a
 * workspace's test files in ONE process — so a resolved `absent` here becomes
 * `absent` for every file that runs afterwards. That is not theoretical: leaving
 * it set sent every later wizard, chooser and starter-set test to the in-memory
 * backend, and roughly a dozen of them failed asserting on rows that had been
 * written to a Map instead of IndexedDB.
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
    // This is the value `backendForMode` sees at boot, and the reason it must
    // resolve toward `local` rather than `memory`.
    expect(legacyLocalDataState()).toBe('unknown')
  })

  test('is remembered, so the answer is stable across calls', async () => {
    await db.pilots.put(pilotFixture({ id: 'legacy-2' }))
    await probeLegacyLocalData()
    expect(legacyLocalDataState()).toBe('present')

    // Clearing the store afterwards must NOT flip the answer back: a browser
    // that had a roster this session keeps the local backend, and re-probing
    // into `absent` mid-session would move the write target out from under it.
    await db._clearAllStores()
    expect(await probeLegacyLocalData()).toBe('present')
  })
})
