/**
 * `buildEntityExport` for a mech, a crawler and a built NPC — the single-entity
 * export each sheet's Export offers. `export.test.ts` covers a pilot; these
 * are the other three kinds, each carrying only itself and the soft links that
 * touch it, and an id that is not there exporting nothing rather than throwing.
 *
 * Seeded the way the server's rows arrive (`adopt`), into the real store.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import {
  crawlerFixture,
  mechFixture,
  npcFixture,
  pilotFixture,
  softLinkFixture,
} from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../stores/__tests__/resetStores'
import { useEntityStore } from '../../../stores/entityStore'
import { buildEntityExport } from '../buildExportBundle'

const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel' })
const otherMech = mechFixture({ id: 'm2', name: 'Spare' })
const pilot = pilotFixture({ id: 'p1', name: 'Vesh' })
const crawler = crawlerFixture({ id: 'c1', name: 'Mother Hen' })
const npc = npcFixture({ id: 'n1', name: 'Old Mags' })

const mechToPilot = softLinkFixture('mech-to-pilot', 'm1', 'p1')
const pilotToCrawler = softLinkFixture('pilot-to-crawler', 'p1', 'c1')
const npcToCrawler = softLinkFixture('npc-to-crawler', 'n1', 'c1')

beforeEach(async () => {
  resetStores()
  const store = useEntityStore.getState()
  for (const m of [mech, otherMech]) await store.adopt('mech', m)
  await store.adopt('pilot', pilot)
  await store.adopt('crawler', crawler)
  await store.adopt('npc', npc)
  for (const link of [mechToPilot, pilotToCrawler, npcToCrawler]) {
    await store.adopt('softLink', link)
  }
})

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id)

describe('buildEntityExport', () => {
  test('a mech: only that mech, and only the links that touch it', async () => {
    const bundle = await buildEntityExport('mech', 'm1', useEntityStore.getState())
    expect(bundle.schemaVersion).toBe(2)
    expect(ids(bundle.entities.mechs)).toEqual(['m1'])
    expect(bundle.entities.pilots).toEqual([])
    expect(bundle.entities.crawlers).toEqual([])
    expect(bundle.entities.npcs).toEqual([])
    expect(ids(bundle.softLinks)).toEqual([mechToPilot.id])
    expect(bundle.mechPatterns).toEqual([])
    expect(bundle.encounterNpcs).toEqual([])
  })

  test('a crawler: its crew links come with it, the crew does not', async () => {
    const bundle = await buildEntityExport('crawler', 'c1', useEntityStore.getState())
    expect(ids(bundle.entities.crawlers)).toEqual(['c1'])
    expect(bundle.entities.pilots).toEqual([])
    expect(bundle.entities.npcs).toEqual([])
    expect(ids(bundle.softLinks).sort()).toEqual([npcToCrawler.id, pilotToCrawler.id].sort())
  })

  test('a built NPC: itself and its crew link', async () => {
    const bundle = await buildEntityExport('npc', 'n1', useEntityStore.getState())
    expect(ids(bundle.entities.npcs)).toEqual(['n1'])
    expect(bundle.entities.npcs[0]?.name).toBe('Old Mags')
    expect(ids(bundle.softLinks)).toEqual([npcToCrawler.id])
  })

  test('an id that is not there exports an empty bundle', async () => {
    const store = useEntityStore.getState()
    for (const kind of ['mech', 'crawler', 'npc'] as const) {
      const bundle = await buildEntityExport(kind, 'missing', store)
      expect(bundle.entities).toEqual({ pilots: [], mechs: [], crawlers: [], npcs: [] })
      expect(bundle.softLinks).toEqual([])
    }
  })
})
