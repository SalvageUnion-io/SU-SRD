/**
 * entityStore integrity tests (plan 2.7, gap 9):
 *   - deleting a pilot/mech/crawler prunes every SoftLink referencing it
 *   - updateCrawlerBay merges a single bay entry onto the record held in
 *     memory right now (per-bay merge, no whole-array clobber)
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useEntityStore } from '../entityStore'
import { LIVE_SHEET_MANUAL } from '../surfaceProvenance'
import { resetStores } from './resetStores'
import { withSignedInBackend } from './signedInBackend'

// These write, and only the signed-in backend writes. See signedInBackend.ts.
withSignedInBackend()

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

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  resetStores()
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

    // Both links are pruned from the store.
    expect(useEntityStore.getState().get('softLink', mechLink.id)).toBeNull()
    expect(useEntityStore.getState().get('softLink', crawlerLink.id)).toBeNull()

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

    expect(useEntityStore.getState().get('softLink', survivorLink.id)).not.toBeNull()
  })
})

describe('updateCrawlerBay — per-bay merge', () => {
  test('patches one bay entry against the record held right now', async () => {
    const store = useEntityStore.getState()
    await store.hydrate('crawler')
    const crawler = await store.create('crawler', baseCrawlerInput)

    // ANOTHER writer (another tab or device) lands a change after the caller
    // read its copy: the server sends the crawler back with the command-bay
    // NPC renamed, and the store adopts it.
    await useEntityStore.getState().adopt('crawler', {
      ...crawler,
      updatedAt: new Date(Date.parse(crawler.updatedAt) + 1000).toISOString(),
      crawlerBays: [
        {
          bayRef: 'command-bay',
          npcName: 'Renamed Elsewhere',
          npcCurrentHP: 4,
        },
        { bayRef: 'mech-bay', npcName: 'Wexel', npcCurrentHP: 4 },
      ],
    })

    // The caller patches the OTHER bay. A whole-array write from stale memory
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
