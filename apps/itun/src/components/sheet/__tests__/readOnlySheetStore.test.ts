import { describe, expect, test } from 'bun:test'
import { LIVE_SHEET_MANUAL } from '../../../stores/surfaceProvenance'
import { crawlerFixture, mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { makeReadOnlySheetStore, sheetDataFromListing } from '../readOnlySheetStore'

/**
 * The read-only sheet store, fed from a Game's listing: every body filed under
 * the id links address it by, every link carried, and no way to write.
 */

const listing = {
  pilots: [
    { _id: 'r1', appId: 'p1', ownerId: 'u1', body: pilotFixture({ id: 'p1', name: 'Ash' }) },
    // A template pre-gen: no app id, so its body id is what links name.
    { _id: 'r2', appId: null, ownerId: null, body: pilotFixture({ id: 'tmpl', name: 'Pre-gen' }) },
    // Built by an app this one cannot read: left out, not crashed on.
    { _id: 'r3', appId: 'p3', ownerId: 'u2', body: { id: 'p3', name: 'Broken' } },
  ],
  mechs: [{ _id: 'r4', appId: 'm1', ownerId: 'u1', body: mechFixture({ id: 'm1' }) }],
  crawlers: [{ _id: 'r5', appId: 'c1', body: crawlerFixture({ id: 'c1' }) }],
  softLinks: [
    {
      _id: 'l1',
      _creationTime: 0,
      gameId: 'g1',
      from: { type: 'mech' as const, id: 'm1' },
      to: { type: 'pilot' as const, id: 'p1' },
      type: 'mech-to-pilot' as const,
    },
  ],
}

describe('sheetDataFromListing', () => {
  test('files each body under its app id, or its body id when it has none', () => {
    const data = sheetDataFromListing(listing)
    expect(data.pilots.map((p) => p.id)).toEqual(['p1', 'tmpl'])
    expect(data.mechs.map((m) => m.id)).toEqual(['m1'])
    expect(data.crawlers.map((c) => c.id)).toEqual(['c1'])
    expect(data.softLinks).toEqual([
      {
        id: 'l1',
        type: 'mech-to-pilot',
        from: { type: 'mech', id: 'm1' },
        to: { type: 'pilot', id: 'p1' },
        createdAt: new Date(0).toISOString(),
      },
    ])
  })
})

describe('makeReadOnlySheetStore', () => {
  test('reads serve the data', () => {
    const state = makeReadOnlySheetStore(sheetDataFromListing(listing)).getState()
    expect(state.get('pilot', 'p1')?.name).toBe('Ash')
    expect(state.get('pilot', 'p3')).toBeNull()
    expect(state.list('mech')).toHaveLength(1)
  })

  test('every write throws, so no control can look like it saved', async () => {
    const state = makeReadOnlySheetStore(sheetDataFromListing(listing)).getState()
    await expect(state.update('pilot', 'p1', { name: 'x' }, LIVE_SHEET_MANUAL)).rejects.toThrow(
      /read-only/
    )
    await expect(state.adopt('pilot', pilotFixture({ id: 'p9' }))).rejects.toThrow(/read-only/)
    await expect(state.delete('softLink', 'l1')).rejects.toThrow(/read-only/)
  })
})
