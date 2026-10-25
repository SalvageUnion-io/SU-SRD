/**
 * `adopt` on a hydrated collection — the path `ConvexFeed` fills the store by.
 *
 * These exist because a commit message claimed four of them and none had been
 * written. The write path they cover shipped with zero coverage while its own
 * description asserted otherwise, which is the exact defect class the branch
 * they belong to was opened to remove.
 *
 * What `adopt` is for: `entities.listMine` returns the account's saved
 * patterns, so a signed-in player on a second device gets their pattern library
 * with their roster. It places a server record into the store WITHOUT that
 * placement being mistaken for a user write and sent back up.
 *
 * Signed in, because that is the only place `ConvexFeed` runs: signed out a
 * store holds nothing (`readableRows`), so there is no library there by
 * design.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { FIXTURE_NOW } from '../../components/__tests__/fixtures'
import { usePatterns } from '../collections'
import { resetStores } from './resetStores'
import { withSignedInBackend } from './signedInBackend'

withSignedInBackend()

function pattern(id: string, name = 'Mule Pattern'): MechPattern {
  return {
    id,
    schemaVersion: 1,
    name,
    chassisRef: 'mule',
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
  }
}

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  resetStores()
})

describe('adopt', () => {
  test('places a server record into the store', async () => {
    await usePatterns.getState().adopt(pattern('p1'))
    expect(
      usePatterns
        .getState()
        .list()
        .map((r) => r.id)
    ).toEqual(['p1'])
  })

  test('is idempotent — re-adopting does not duplicate', async () => {
    // `ConvexFeed` re-runs whenever the server emission changes, and a pattern
    // present in two consecutive emissions must not become two rows.
    await usePatterns.getState().adopt(pattern('p1'))
    await usePatterns.getState().adopt(pattern('p1'))
    expect(usePatterns.getState().list()).toHaveLength(1)
  })

  test('adopting an existing id replaces it in place', async () => {
    // Server wins: the row that comes down is adopted over whatever the store
    // held. No merge — with one source of truth there is no second writer.
    await usePatterns.getState().adopt(pattern('p1', 'Old Name'))
    await usePatterns.getState().adopt(pattern('p1', 'New Name'))
    const rows = usePatterns.getState().list()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('New Name')
  })

  test('a malformed body throws rather than writing a bad row', async () => {
    // `ConvexFeed` catches per row so one bad pattern cannot stop the rest of
    // the library arriving; that only works if `adopt` actually rejects.
    await expect(
      usePatterns.getState().adopt({ id: 'bad' } as unknown as MechPattern)
    ).rejects.toBeDefined()
    expect(usePatterns.getState().list()).toHaveLength(0)
  })
})
