/**
 * entityStore.transfer() — atomic cross-entity value transfers (audit item 2).
 *
 * The load-bearing guarantees:
 *   1. update + delete spanning two stores commit together.
 *   2. A validation failure on ANY patch aborts the whole transfer — nothing
 *      is written (the scrap-value-duplication bug class).
 *   3. Deletes cascade SoftLinks, same as delete().
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { _clearAllStores, _resetDbSingleton, crawlers, mechs, softLinks } from '../../lib/db/index'
import { useEntityStore } from '../entityStore'
import { LIVE_SHEET_MANUAL } from '../surfaceProvenance'

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

async function seed() {
  const mech = await useEntityStore.getState().create('mech', {
    schemaVersion: 1 as const,
    name: 'Doomed Mule',
    chassisRef: 'mule',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
  })
  const crawler = await useEntityStore.getState().create('crawler', {
    schemaVersion: 1 as const,
    name: 'Home Base',
    techLevel: 'tech-1',
    systems: [],
  })
  return { mech, crawler }
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
  await useEntityStore.getState().hydrate('mech')
  await useEntityStore.getState().hydrate('crawler')
  await useEntityStore.getState().hydrate('softLink')
})

describe('entityStore.transfer', () => {
  test('commits an update and a delete across stores together', async () => {
    const { mech, crawler } = await seed()

    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'crawler', id: crawler.id, patch: { scrapPool: { tl1: 3 } } }],
        deletes: [{ type: 'mech', id: mech.id }],
      },
      LIVE_SHEET_MANUAL
    )

    // On disk:
    expect((await crawlers.get(crawler.id))?.scrapPool).toEqual({ tl1: 3 })
    expect(await mechs.get(mech.id)).toBeNull()
    // In memory:
    expect(useEntityStore.getState().get('crawler', crawler.id)?.scrapPool).toEqual({ tl1: 3 })
    expect(useEntityStore.getState().get('mech', mech.id)).toBeNull()
  })

  test('a validation failure on one patch aborts the WHOLE transfer', async () => {
    const { mech, crawler } = await seed()

    await expect(
      useEntityStore.getState().transfer(
        {
          updates: [
            // Invalid: currentSP must be >= 0 — strict parse throws.
            { type: 'crawler', id: crawler.id, patch: { currentSP: -5 } },
          ],
          deletes: [{ type: 'mech', id: mech.id }],
        },
        LIVE_SHEET_MANUAL
      )
    ).rejects.toThrow()

    // Nothing changed: the mech still exists, the crawler is untouched.
    expect(await mechs.get(mech.id)).not.toBeNull()
    expect((await crawlers.get(crawler.id))?.currentSP).toBeUndefined()
    expect(useEntityStore.getState().get('mech', mech.id)).not.toBeNull()
  })

  test('an update on a missing record aborts the delete too', async () => {
    const { mech } = await seed()

    await expect(
      useEntityStore.getState().transfer(
        {
          updates: [{ type: 'crawler', id: 'no-such-crawler', patch: { scrapPool: {} } }],
          deletes: [{ type: 'mech', id: mech.id }],
        },
        LIVE_SHEET_MANUAL
      )
    ).rejects.toThrow()

    expect(await mechs.get(mech.id)).not.toBeNull()
  })

  test('deletes cascade SoftLinks inside the same transaction', async () => {
    const { mech, crawler } = await seed()
    const link = await useEntityStore.getState().create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: crawler.id },
      type: 'mech-to-pilot',
    })

    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'crawler', id: crawler.id, patch: { scrapPool: { tl2: 1 } } }],
        deletes: [{ type: 'mech', id: mech.id }],
      },
      LIVE_SHEET_MANUAL
    )

    expect(await softLinks.get(link.id)).toBeNull()
    expect(useEntityStore.getState().list('softLink')).toHaveLength(0)
  })

  test('no-op transfer resolves without touching anything', async () => {
    await expect(useEntityStore.getState().transfer({}, LIVE_SHEET_MANUAL)).resolves.toBeUndefined()
  })
})
