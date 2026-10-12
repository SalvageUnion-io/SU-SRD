/**
 * Export/import coverage for mech patterns (plan 2.6, gap 6) and the
 * additive `.default([])` arrays on import.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../stores/__tests__/resetStores'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { usePatternStore } from '../../../stores/patternStore'
import { buildExportBundle } from '../buildExportBundle'
import { mergeImport } from '../mergeImport'
import { parseImportBundle } from '../parseImportBundle'

// Saving a pattern and importing one are writes, and only somebody signed in
// can write (ADR-034 as amended). See signedInBackend.ts.
withSignedInBackend()

beforeEach(resetStores)
afterEach(resetStores)

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
    await usePatternStore.getState().create(patternInput)

    const bundle = await buildExportBundle(useEntityStore.getState())

    expect(bundle.mechPatterns).toHaveLength(1)
    expect(bundle.mechPatterns[0]?.name).toBe('Scout Loadout')
  })
})

describe('mergeImport — mech patterns', () => {
  test('round-trip: exported patterns import with fresh ids', async () => {
    const created = await usePatternStore.getState().create(patternInput)
    const bundle = await buildExportBundle(useEntityStore.getState())

    // Simulate a different account: empty every store, then import.
    resetStores()

    const summary = await mergeImport(bundle, useEntityStore.getState())
    expect(summary.created.mechPatterns).toBe(1)

    const imported = usePatternStore.getState().list()
    expect(imported).toHaveLength(1)
    expect(imported[0]?.name).toBe('Scout Loadout')
    expect(imported[0]?.id).not.toBe(created.id) // imported under a fresh id
  })

  test('exact-id duplicates are skipped', async () => {
    await usePatternStore.getState().create(patternInput)
    const bundle = await buildExportBundle(useEntityStore.getState())

    // Import into the SAME store — the pattern id already exists.
    const summary = await mergeImport(bundle, useEntityStore.getState())
    expect(summary.created.mechPatterns).toBe(0)
    // Exactly one: the store holds a single pattern and nothing else.
    expect(summary.skippedDuplicates).toBe(1)
    expect(usePatternStore.getState().list()).toHaveLength(1)
  })
})

describe('parseImportBundle — additive arrays', () => {
  test('a bundle without mechPatterns/encounterNpcs gets empty arrays', () => {
    const bundle = {
      schemaVersion: 2,
      exportedAt: FIXTURE_NOW,
      entities: { pilots: [], mechs: [], crawlers: [] },
      softLinks: [],
    }

    const parsed = parseImportBundle(JSON.stringify(bundle))
    expect(parsed.mechPatterns).toEqual([])
    expect(parsed.encounterNpcs).toEqual([])
  })
})
