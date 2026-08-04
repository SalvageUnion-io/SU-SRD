/**
 * entityStore integrity tests (plan 2.7, gap 9):
 *   - deleting a pilot/mech/crawler prunes every SoftLink referencing it
 *   - updateCrawlerBay merges a single bay entry onto the freshest persisted
 *     record (per-bay merge, no whole-array clobber)
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton, softLinks as dbSoftLinks } from '../../lib/db/index'
import { useEntityStore } from '../entityStore'
import { LIVE_SHEET_MANUAL } from '../surfaceProvenance'

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
}

const baseMechInput = {
  schemaVersion: 1 as const,
  name: 'Rust Bucket',
  chassisRef: 'Iron Mongrel Chassis',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

const baseCrawlerInput = {
  schemaVersion: 1 as const,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  crawlerBays: [
    { bayRef: 'command-bay', npcName: 'Sarn', npcCurrentHP: 4 },
    { bayRef: 'mech-bay', npcName: 'Wexel', npcCurrentHP: 4 },
  ],
}

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: {
      pilots: false,
      mechs: false,
      crawlers: false,
      softLinks: false,
    },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(async () => {
  await _clearAllStores()
  resetEntityStore()
})

describe('entity delete cascades to softLinks', () => {
  test('deleting a pilot deletes every link touching it (both directions)', async () => {
    const store = useEntityStore.getState()
    await Promise.all([
      store.hydrate('pilot'),
      store.hydrate('mech'),
      store.hydrate('crawler'),
      store.hydrate('softLink'),
    ])

    const pilot = await store.create('pilot', basePilotInput)
    const mech = await store.create('mech', baseMechInput)
    const crawler = await store.create('crawler', baseCrawlerInput)

    // mech → pilot (pilot is the `to` endpoint)
    const mechLink = await store.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })
    // pilot → crawler (pilot is the `from` endpoint)
    const crawlerLink = await store.create('softLink', {
      from: { type: 'pilot', id: pilot.id },
      to: { type: 'crawler', id: crawler.id },
      type: 'pilot-to-crawler',
    })

    await useEntityStore.getState().delete('pilot', pilot.id)

    // In-memory state pruned…
    const remaining = useEntityStore.getState().softLinks
    expect(remaining.find((l) => l.id === mechLink.id)).toBeUndefined()
    expect(remaining.find((l) => l.id === crawlerLink.id)).toBeUndefined()

    // …and persisted state too.
    expect(await dbSoftLinks.get(mechLink.id)).toBeNull()
    expect(await dbSoftLinks.get(crawlerLink.id)).toBeNull()

    // Unrelated entities survive.
    expect(useEntityStore.getState().get('mech', mech.id)).not.toBeNull()
    expect(useEntityStore.getState().get('crawler', crawler.id)).not.toBeNull()
  })

  test('links between OTHER entities are untouched', async () => {
    const store = useEntityStore.getState()
    await Promise.all([store.hydrate('pilot'), store.hydrate('mech'), store.hydrate('softLink')])

    const victim = await store.create('pilot', basePilotInput)
    const survivor = await store.create('pilot', {
      ...basePilotInput,
      name: 'Survivor',
    })
    const mech = await store.create('mech', baseMechInput)
    const survivorLink = await store.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: survivor.id },
      type: 'mech-to-pilot',
    })

    await useEntityStore.getState().delete('pilot', victim.id)

    expect(await dbSoftLinks.get(survivorLink.id)).not.toBeNull()
  })
})

describe('updateCrawlerBay — per-bay merge', () => {
  test('patches one bay entry against the freshest persisted record', async () => {
    const store = useEntityStore.getState()
    await store.hydrate('crawler')
    const crawler = await store.create('crawler', baseCrawlerInput)

    // Simulate ANOTHER writer (another tab) landing a change this tab's
    // in-memory copy has not seen: command-bay NPC renamed directly in IDB.
    const { crawlers: dbCrawlers } = await import('../../lib/db/index')
    await dbCrawlers.update(crawler.id, {
      crawlerBays: [
        {
          bayRef: 'command-bay',
          npcName: 'Renamed Elsewhere',
          npcCurrentHP: 4,
        },
        { bayRef: 'mech-bay', npcName: 'Wexel', npcCurrentHP: 4 },
      ],
    })

    // This tab patches the OTHER bay. A whole-array write from stale memory
    // would clobber the rename; the per-bay merge must not.
    const updated = await useEntityStore
      .getState()
      .updateCrawlerBay(crawler.id, 'mech-bay', { npcCurrentHP: 1 }, 1, LIVE_SHEET_MANUAL)

    expect(updated.crawlerBays).toEqual([
      { bayRef: 'command-bay', npcName: 'Renamed Elsewhere', npcCurrentHP: 4 },
      { bayRef: 'mech-bay', npcName: 'Wexel', npcCurrentHP: 1 },
    ])
  })

  test('throws for an unknown crawler or bayRef', async () => {
    const store = useEntityStore.getState()
    await store.hydrate('crawler')
    const crawler = await store.create('crawler', baseCrawlerInput)

    expect(
      useEntityStore
        .getState()
        .updateCrawlerBay('nope', 'command-bay', {}, undefined, LIVE_SHEET_MANUAL)
    ).rejects.toThrow('not found')
    expect(
      useEntityStore
        .getState()
        .updateCrawlerBay(crawler.id, 'cantina', {}, undefined, LIVE_SHEET_MANUAL)
    ).rejects.toThrow('not found')
  })
})
