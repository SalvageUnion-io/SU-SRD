/**
 * `adopt` on a hydrated collection — the cache-fill path `ShelfSync` uses.
 *
 * These exist because a commit message claimed four of them and none had been
 * written. The write path they cover shipped with zero coverage while its own
 * description asserted otherwise, which is the exact defect class the branch
 * they belong to was opened to remove.
 *
 * What `adopt` is for: `entities.listMine` returns the account's saved patterns,
 * and before this they were fetched and discarded — a signed-in player on a
 * second device got their roster and an empty pattern library. It places a
 * server record into the cache WITHOUT that placement being mistaken for a user
 * write and mirrored back up.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { BACKUP_NUDGE_WRITE_THRESHOLD, getBackupNudgeState } from '../../lib/backupNudge'
import { _clearAllStores, _resetDbSingleton } from '../../lib/db/index'
import type { MechPattern } from '../../lib/schemas/pattern'
import { usePatternStore } from '../patternStore'

function pattern(id: string, name = 'Mule Pattern'): MechPattern {
  return {
    id,
    schemaVersion: 1,
    name,
    chassisRef: 'mule',
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  usePatternStore.setState({ mechPatterns: [], hydrated: false })
})

afterEach(async () => {
  await _clearAllStores()
})

describe('adopt', () => {
  test('places a server record into the cache', async () => {
    await usePatternStore.getState().adopt(pattern('p1'))
    expect(
      usePatternStore
        .getState()
        .list()
        .map((r) => r.id)
    ).toEqual(['p1'])
  })

  test('is idempotent — re-adopting does not duplicate', async () => {
    // `ShelfSync` re-runs whenever the server emission changes, and a pattern
    // present in two consecutive emissions must not become two rows.
    await usePatternStore.getState().adopt(pattern('p1'))
    await usePatternStore.getState().adopt(pattern('p1'))
    expect(usePatternStore.getState().list()).toHaveLength(1)
  })

  test('adopting an existing id replaces it in place', async () => {
    // Server wins: the row that comes down is adopted over whatever the cache
    // held. No merge — with one source of truth there is no second writer.
    await usePatternStore.getState().adopt(pattern('p1', 'Old Name'))
    await usePatternStore.getState().adopt(pattern('p1', 'New Name'))
    const rows = usePatternStore.getState().list()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('New Name')
  })

  test('survives to disk, so a reload keeps the library', async () => {
    // The whole point of the fix: the pattern library must still be there on
    // the next boot, not just in this tab's memory.
    await usePatternStore.getState().adopt(pattern('p1'))
    usePatternStore.setState({ mechPatterns: [], hydrated: false })
    await usePatternStore.getState().rehydrate()
    expect(
      usePatternStore
        .getState()
        .list()
        .map((r) => r.id)
    ).toEqual(['p1'])
  })

  test('a malformed body throws rather than writing a bad row', async () => {
    // `ShelfSync` catches per row so one bad pattern cannot stop the rest of
    // the library arriving; that only works if `adopt` actually rejects.
    await expect(
      usePatternStore.getState().adopt({ id: 'bad' } as unknown as MechPattern)
    ).rejects.toBeDefined()
    expect(usePatternStore.getState().list()).toHaveLength(0)
  })
})

describe('adopt does not count as a user write', () => {
  test('a sync of many patterns never triggers the backup nudge', async () => {
    // The one place `adopt` deliberately diverges from the slice's other
    // writers. `afterWrite()` calls `recordDataWrite()`, which drives the
    // backup nudge at BACKUP_NUDGE_WRITE_THRESHOLD (25) against a
    // localStorage-persistent counter.
    //
    // Routing adoption through it meant a signed-in player with 25+ saved
    // patterns was told to "back up your data" after a sync in which they had
    // written nothing — and again on every later sync. `entityStore.adopt` and
    // `forget` both publish without recording, for exactly this reason.
    const before = getBackupNudgeState().dirtyWrites

    for (let i = 0; i < BACKUP_NUDGE_WRITE_THRESHOLD + 5; i += 1) {
      await usePatternStore.getState().adopt(pattern(`sync-${i}`))
    }

    expect(getBackupNudgeState().dirtyWrites).toBe(before)
  })

  test('an ordinary create still counts', async () => {
    // Control: the nudge must still work. If `adopt` were fixed by disabling
    // the counter outright, this would fail.
    const before = getBackupNudgeState().dirtyWrites
    await usePatternStore.getState().create({
      schemaVersion: 1,
      name: 'Hand-saved',
      chassisRef: 'mule',
      systems: [],
      modules: [],
      cargoLots: [],
    } as never)
    expect(getBackupNudgeState().dirtyWrites).toBeGreaterThan(before)
  })
})
