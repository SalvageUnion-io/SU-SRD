/**
 * Unit tests for lib/export/* utilities.
 *
 * Uses fake-indexeddb (preloaded via bunfig.toml) + the real entityStore /
 * workspaceStore so we exercise the full CRUD path without a real browser.
 *
 * Test matrix:
 *   - parseImportBundle: valid bundle, malformed JSON, wrong schemaVersion
 *   - buildExportBundle: round-trip with pilots + softLinks + workspaces
 *   - buildEntityExport: single entity + attached softLinks only
 *   - mergeImport: fresh ids, id-remap integrity, duplicate skip, dangling ref skip
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton } from '../../db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

import { buildExportBundle, buildEntityExport } from '../buildExportBundle'
import { mergeImport } from '../mergeImport'
import { parseImportBundle } from '../parseImportBundle'
import type { ExportBundle } from '../../schemas/exportBundle'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Test Pilot',
  callsign: 'TP',
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
  name: 'Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

const baseCrawlerInput = {
  schemaVersion: 1 as const,
  name: 'Test Crawler',
  techLevel: 'tech-1',
  systems: [],
}

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

function resetWorkspaceStore(): void {
  useWorkspaceStore.setState({ workspaces: [], hydrated: false })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
  resetWorkspaceStore()
})

afterEach(async () => {
  await _clearAllStores()
  resetEntityStore()
  resetWorkspaceStore()
})

// ---------------------------------------------------------------------------
// parseImportBundle
// ---------------------------------------------------------------------------

describe('parseImportBundle', () => {
  test('accepts a valid minimal bundle', () => {
    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      entities: { pilots: [], mechs: [], crawlers: [] },
      workspaces: [],
      softLinks: [],
      mechPatterns: [],
      encounterNpcs: [],
    }
    const result = parseImportBundle(JSON.stringify(bundle))
    // A v1 payload is normalised to the current version on the way in, so the
    // rest of the pipeline sees one format (ADR-030 containers).
    expect(result.schemaVersion).toBe(2)
    expect(result.entities.pilots).toEqual([])
  })

  test('rejects malformed JSON', () => {
    expect(() => parseImportBundle('{not json')).toThrow('not valid JSON')
  })

  test('rejects bundle with wrong schemaVersion', () => {
    const badBundle = {
      schemaVersion: 99,
      exportedAt: new Date().toISOString(),
      entities: { pilots: [], mechs: [], crawlers: [] },
      workspaces: [],
      softLinks: [],
      mechPatterns: [],
      encounterNpcs: [],
    }
    expect(() => parseImportBundle(JSON.stringify(badBundle))).toThrow('unsupported schemaVersion')
  })

  test('rejects bundle missing required fields', () => {
    const incomplete = { schemaVersion: 1, exportedAt: new Date().toISOString() }
    expect(() => parseImportBundle(JSON.stringify(incomplete))).toThrow('Import failed')
  })
})

// ---------------------------------------------------------------------------
// buildExportBundle — round-trip
// ---------------------------------------------------------------------------

describe('buildExportBundle', () => {
  test('round-trip: build then parse yields valid bundle', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    await entityStore.hydrate('pilot')
    await entityStore.create('pilot', basePilotInput)

    const bundle = await buildExportBundle(entityStore, workspaceStore)

    expect(bundle.schemaVersion).toBe(2)
    expect(bundle.entities.pilots).toHaveLength(1)
    expect(bundle.entities.pilots[0]?.name).toBe('Test Pilot')
    expect(bundle.entities.mechs).toHaveLength(0)
    expect(bundle.softLinks).toHaveLength(0)
    expect(bundle.workspaces).toHaveLength(0)

    // Must be parseable again
    const reparsed = parseImportBundle(JSON.stringify(bundle))
    expect(reparsed.entities.pilots[0]?.name).toBe('Test Pilot')
  })

  test('includes softLinks and workspaces in full backup', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    await workspaceStore.hydrate()
    const ws = await workspaceStore.create({ name: 'Campaign Alpha' })

    await entityStore.hydrate('pilot')
    const pilot = await entityStore.create('pilot', {
      ...basePilotInput,
      workspaceId: ws.id,
    })

    await entityStore.hydrate('mech')
    const mech = await entityStore.create('mech', baseMechInput)

    await entityStore.hydrate('softLink')
    await entityStore.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })

    const bundle = await buildExportBundle(entityStore, workspaceStore)

    expect(bundle.workspaces).toHaveLength(1)
    expect(bundle.workspaces[0]?.name).toBe('Campaign Alpha')
    expect(bundle.entities.pilots).toHaveLength(1)
    expect(bundle.entities.mechs).toHaveLength(1)
    expect(bundle.softLinks).toHaveLength(1)
    expect(bundle.softLinks[0]?.from.id).toBe(mech.id)
  })
})

// ---------------------------------------------------------------------------
// buildEntityExport — single entity
// ---------------------------------------------------------------------------

describe('buildEntityExport', () => {
  test('exports only the target pilot and its attached softLinks', async () => {
    const entityStore = useEntityStore.getState()

    await entityStore.hydrate('pilot')
    const pilotA = await entityStore.create('pilot', { ...basePilotInput, name: 'Pilot A' })
    const pilotB = await entityStore.create('pilot', { ...basePilotInput, name: 'Pilot B' })

    await entityStore.hydrate('mech')
    const mech = await entityStore.create('mech', baseMechInput)

    await entityStore.hydrate('softLink')
    // Link: mech → pilotA (attached to pilotA)
    await entityStore.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilotA.id },
      type: 'mech-to-pilot',
    })
    // Link: pilotB → crawler (not attached to pilotA)
    await entityStore.hydrate('crawler')
    const crawler = await entityStore.create('crawler', baseCrawlerInput)
    await entityStore.create('softLink', {
      from: { type: 'pilot', id: pilotB.id },
      to: { type: 'crawler', id: crawler.id },
      type: 'pilot-to-crawler',
    })

    const bundle = await buildEntityExport('pilot', pilotA.id, entityStore)

    expect(bundle.entities.pilots).toHaveLength(1)
    expect(bundle.entities.pilots[0]?.id).toBe(pilotA.id)
    expect(bundle.entities.mechs).toHaveLength(0)
    expect(bundle.entities.crawlers).toHaveLength(0)
    // Only the link touching pilotA
    expect(bundle.softLinks).toHaveLength(1)
    expect(bundle.softLinks[0]?.to.id).toBe(pilotA.id)
    // Workspaces are not included in single-entity export
    expect(bundle.workspaces).toHaveLength(0)
  })

  test('returns empty entities array when id not found', async () => {
    const entityStore = useEntityStore.getState()
    const bundle = await buildEntityExport('pilot', 'nonexistent-id', entityStore)
    expect(bundle.entities.pilots).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// mergeImport — round-trip + id integrity
// ---------------------------------------------------------------------------

describe('mergeImport — round-trip', () => {
  test('importing into empty store creates all entities with fresh ids', async () => {
    // Build source store with one pilot, one mech, one link, one workspace.
    const sourceEntityStore = useEntityStore.getState()
    const sourceWorkspaceStore = useWorkspaceStore.getState()

    await sourceWorkspaceStore.hydrate()
    const ws = await sourceWorkspaceStore.create({ name: 'Campaign Alpha' })

    await sourceEntityStore.hydrate('pilot')
    const pilot = await sourceEntityStore.create('pilot', {
      ...basePilotInput,
      workspaceId: ws.id,
    })

    await sourceEntityStore.hydrate('mech')
    const mech = await sourceEntityStore.create('mech', baseMechInput)

    await sourceEntityStore.hydrate('softLink')
    await sourceEntityStore.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })

    const bundle = await buildExportBundle(sourceEntityStore, sourceWorkspaceStore)

    // ---- reset to simulate a fresh target store ----
    _resetDbSingleton()
    await _clearAllStores()
    resetEntityStore()
    resetWorkspaceStore()

    const targetEntityStore = useEntityStore.getState()
    const targetWorkspaceStore = useWorkspaceStore.getState()

    const summary = await mergeImport(bundle, targetEntityStore, targetWorkspaceStore)

    expect(summary.created.pilots).toBe(1)
    expect(summary.created.mechs).toBe(1)
    expect(summary.created.workspaces).toBe(1)
    expect(summary.created.softLinks).toBe(1)
    expect(summary.skippedDuplicates).toBe(0)

    // Re-hydrate to verify state
    _resetDbSingleton()
    resetEntityStore()
    resetWorkspaceStore()
    const verifyEntityStore = useEntityStore.getState()
    const verifyWorkspaceStore = useWorkspaceStore.getState()
    await verifyEntityStore.hydrate('pilot')
    await verifyEntityStore.hydrate('mech')
    await verifyEntityStore.hydrate('softLink')
    await verifyWorkspaceStore.hydrate()

    const importedPilots = verifyEntityStore.list('pilot')
    const importedMechs = verifyEntityStore.list('mech')
    const importedLinks = verifyEntityStore.list('softLink')
    const importedWorkspaces = verifyWorkspaceStore.list()

    expect(importedPilots).toHaveLength(1)
    expect(importedPilots[0]?.name).toBe('Test Pilot')
    // Fresh id — must differ from source
    expect(importedPilots[0]?.id).not.toBe(pilot.id)

    expect(importedMechs).toHaveLength(1)
    expect(importedMechs[0]?.id).not.toBe(mech.id)

    expect(importedWorkspaces).toHaveLength(1)
    expect(importedWorkspaces[0]?.name).toBe('Campaign Alpha')
    const newWsId = importedWorkspaces[0]?.id
    expect(newWsId).not.toBe(ws.id)

    // Pilot's workspaceId must point to the NEW workspace id.
    expect(importedPilots[0]?.workspaceId).toBe(newWsId)

    // SoftLink must reference the new pilot and mech ids.
    const importedLink = importedLinks[0]
    expect(importedLink?.from.id).toBe(importedMechs[0]?.id)
    expect(importedLink?.to.id).toBe(importedPilots[0]?.id)
    // No dangling refs
    expect(importedLink?.from.id).not.toBe(mech.id)
    expect(importedLink?.to.id).not.toBe(pilot.id)
  })

  test('id-remap integrity: no dangling softLink refs after import', async () => {
    const sourceEntityStore = useEntityStore.getState()
    const sourceWorkspaceStore = useWorkspaceStore.getState()

    await sourceEntityStore.hydrate('pilot')
    const p1 = await sourceEntityStore.create('pilot', { ...basePilotInput, name: 'P1' })
    const p2 = await sourceEntityStore.create('pilot', { ...basePilotInput, name: 'P2' })

    await sourceEntityStore.hydrate('mech')
    const m = await sourceEntityStore.create('mech', baseMechInput)

    await sourceEntityStore.hydrate('softLink')
    await sourceEntityStore.create('softLink', {
      from: { type: 'mech', id: m.id },
      to: { type: 'pilot', id: p1.id },
      type: 'mech-to-pilot',
    })
    await sourceEntityStore.create('softLink', {
      from: { type: 'pilot', id: p2.id },
      to: { type: 'crawler', id: 'imaginary-crawler-id' }, // dangling — not in bundle
      type: 'pilot-to-crawler',
    })

    // Build bundle — note imaginary-crawler-id is NOT in entities.crawlers
    const bundle = await buildExportBundle(sourceEntityStore, sourceWorkspaceStore)

    _resetDbSingleton()
    await _clearAllStores()
    resetEntityStore()
    resetWorkspaceStore()

    const targetEntityStore = useEntityStore.getState()
    const targetWorkspaceStore = useWorkspaceStore.getState()

    const summary = await mergeImport(bundle, targetEntityStore, targetWorkspaceStore)

    // The dangling link (imaginary-crawler-id not in idMap) should be skipped.
    expect(summary.created.softLinks).toBe(1)

    // Verify all imported link ids are valid
    _resetDbSingleton()
    resetEntityStore()
    resetWorkspaceStore()
    const verifyStore = useEntityStore.getState()
    await verifyStore.hydrate('pilot')
    await verifyStore.hydrate('mech')
    await verifyStore.hydrate('softLink')

    const pilots = verifyStore.list('pilot')
    const mechs = verifyStore.list('mech')
    const links = verifyStore.list('softLink')
    const pilotIds = new Set(pilots.map((p) => p.id))
    const mechIds = new Set(mechs.map((m) => m.id))

    expect(links).toHaveLength(1)
    const link = links[0]
    if (!link) throw new Error('expected an imported soft link')
    // from must be a known mech id
    expect(mechIds.has(link.from.id)).toBe(true)
    // to must be a known pilot id
    expect(pilotIds.has(link.to.id)).toBe(true)
  })

  test('does not overwrite existing entities — skips duplicates', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    await entityStore.hydrate('pilot')
    const existingPilot = await entityStore.create('pilot', {
      ...basePilotInput,
      name: 'Existing Pilot',
    })

    // Build a bundle that contains the same pilot id.
    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      entities: {
        pilots: [existingPilot],
        mechs: [],
        crawlers: [],
      },
      workspaces: [],
      softLinks: [],
      mechPatterns: [],
      encounterNpcs: [],
    }

    const summary = await mergeImport(bundle, entityStore, workspaceStore)

    // Should be skipped, not created again.
    expect(summary.created.pilots).toBe(0)
    expect(summary.skippedDuplicates).toBe(1)

    // Only one pilot should exist.
    _resetDbSingleton()
    resetEntityStore()
    resetWorkspaceStore()
    const verifyStore = useEntityStore.getState()
    await verifyStore.hydrate('pilot')
    expect(verifyStore.list('pilot')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// mergeImport — summary.remappedLinks counter
// ---------------------------------------------------------------------------

describe('mergeImport — remappedLinks counter', () => {
  test('increments remappedLinks when a link endpoint id is remapped', async () => {
    const sourceEntityStore = useEntityStore.getState()
    const sourceWorkspaceStore = useWorkspaceStore.getState()

    await sourceEntityStore.hydrate('pilot')
    const pilot = await sourceEntityStore.create('pilot', basePilotInput)

    await sourceEntityStore.hydrate('mech')
    const mech = await sourceEntityStore.create('mech', baseMechInput)

    await sourceEntityStore.hydrate('softLink')
    await sourceEntityStore.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })

    const bundle = await buildExportBundle(sourceEntityStore, sourceWorkspaceStore)

    _resetDbSingleton()
    await _clearAllStores()
    resetEntityStore()
    resetWorkspaceStore()

    const targetEntityStore = useEntityStore.getState()
    const targetWorkspaceStore = useWorkspaceStore.getState()

    const summary = await mergeImport(bundle, targetEntityStore, targetWorkspaceStore)

    // Ids are always remapped when importing into a fresh store.
    expect(summary.remappedLinks).toBe(1)
  })
})
