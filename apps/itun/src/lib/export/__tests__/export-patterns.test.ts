/**
 * Export/import coverage for mech patterns (plan 2.6, gap 6) and legacy
 * bundle compatibility (cargo → cargoLots normalization on import).
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton, mechPatterns } from '../../db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { buildExportBundle } from '../buildExportBundle'
import { mergeImport } from '../mergeImport'
import { parseImportBundle } from '../parseImportBundle'
import { must } from '../../../components/__tests__/must'

function resetStores(): void {
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
  resetStores()
})

afterEach(async () => {
  await _clearAllStores()
  resetStores()
})

const patternInput = {
  schemaVersion: 1 as const,
  name: 'Scout Loadout',
  chassisRef: 'Mule Chassis',
  systems: ['sensor-suite'],
  modules: [],
  cargoLots: [
    {
      id: 'lot-p1',
      kind: 'unit' as const,
      name: 'medkit',
      cat: 'SEALED' as const,
      units: 1,
      code: 'MED',
    },
  ],
}

describe('buildExportBundle — mech patterns', () => {
  test('a full backup includes saved patterns', async () => {
    await mechPatterns.create(patternInput)

    const bundle = await buildExportBundle(useEntityStore.getState())

    expect(bundle.mechPatterns).toHaveLength(1)
    expect(bundle.mechPatterns[0]?.name).toBe('Scout Loadout')
  })
})

describe('mergeImport — mech patterns', () => {
  test('round-trip: exported patterns import with fresh ids', async () => {
    const created = await mechPatterns.create(patternInput)
    const bundle = await buildExportBundle(useEntityStore.getState())

    // Simulate a different browser: wipe everything, then import.
    await _clearAllStores()
    resetStores()

    const summary = await mergeImport(bundle, useEntityStore.getState())
    expect(summary.created.mechPatterns).toBe(1)

    const imported = await mechPatterns.list()
    expect(imported).toHaveLength(1)
    expect(imported[0]?.name).toBe('Scout Loadout')
    expect(imported[0]?.id).not.toBe(created.id) // imported under a fresh id
  })

  test('exact-id duplicates are skipped', async () => {
    await mechPatterns.create(patternInput)
    const bundle = await buildExportBundle(useEntityStore.getState())

    // Import into the SAME store — the pattern id already exists.
    const summary = await mergeImport(bundle, useEntityStore.getState())
    expect(summary.created.mechPatterns).toBe(0)
    expect(summary.skippedDuplicates).toBeGreaterThanOrEqual(1)
    expect(await mechPatterns.list()).toHaveLength(1)
  })
})

describe('parseImportBundle — legacy compatibility', () => {
  test('a pre-rename bundle (mech cargo: string[], no mechPatterns/encounterNpcs) still imports', () => {
    const legacyBundle = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      entities: {
        pilots: [],
        mechs: [
          {
            id: 'mech-legacy-1',
            schemaVersion: 1,
            name: 'Old Mongrel',
            chassisRef: 'Iron Mongrel Chassis',
            systems: [],
            modules: [],
            cargo: ['Salvaged plating'],
            conditions: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        crawlers: [],
      },
      workspaces: [],
      softLinks: [],
    }

    const parsed = parseImportBundle(JSON.stringify(legacyBundle))
    expect(parsed.mechPatterns).toEqual([]) // schema default fills
    expect(parsed.encounterNpcs).toEqual([]) // schema default fills (added later than mechPatterns, same pattern)
    const mech = must(parsed.entities.mechs[0], 'imported mech')
    expect(mech.cargoLots).toHaveLength(1)
    expect(mech.cargoLots[0]?.name).toBe('Salvaged plating')
    expect('cargo' in mech).toBe(false)
  })

  test('legacy patterns with cargo arrays are normalized too', () => {
    const legacyBundle = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      entities: { pilots: [], mechs: [], crawlers: [] },
      workspaces: [],
      softLinks: [],
      mechPatterns: [
        {
          id: 'pattern-legacy-1',
          schemaVersion: 1,
          name: 'Old Loadout',
          chassisRef: 'Mule Chassis',
          systems: [],
          modules: [],
          cargo: ['fuel-cell'],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }

    const parsed = parseImportBundle(JSON.stringify(legacyBundle))
    expect(parsed.mechPatterns[0]?.cargoLots.map((l) => l.name)).toEqual(['fuel-cell'])
  })
})
