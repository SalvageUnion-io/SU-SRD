/**
 * Export/import round-trip fidelity harness (durability audit, item 3).
 *
 * export.test.ts and export-patterns.test.ts already cover the mechanics
 * (fresh-id assignment, dedup, dangling-link pruning, legacy-bundle
 * normalization) with minimal fixtures (mostly just checking `name`). This
 * file is table-driven over RICH fixtures — every optional/nested field
 * filled in for each entity type — pushed through the full pipeline:
 *
 *   buildExportBundle → JSON.stringify → parseImportBundle → mergeImport
 *
 * and asserts every field survives except the three that are INTENTIONALLY
 * re-minted (id, createdAt, updatedAt) and workspaceId (intentionally
 * remapped to the newly-created workspace's id — see mergeImport's
 * doc-comment). That remap is exercised explicitly, not treated as noise.
 *
 * No property-testing library (e.g. fast-check) is a dependency of this repo
 * (checked package.json first, per the harness brief) — this is deliberately
 * thorough table-driven coverage instead of generative testing.
 *
 * Known gap (not fixed here — out of scope, flagged for follow-up): the
 * `encounterNpcs` store has NO representation in ExportBundleSchema at all.
 * A full backup silently omits GM encounter-tray state. Not addressed in
 * this PR (would be a schema/feature change, not a test-harness fix) — see
 * the PR description.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton, mechPatterns } from '../../db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { buildExportBundle } from '../buildExportBundle'
import { mergeImport } from '../mergeImport'
import { parseImportBundle } from '../parseImportBundle'
import type { ExportBundle } from '../../schemas/exportBundle'

function resetStores(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  useWorkspaceStore.setState({ workspaces: [], hydrated: false })
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

/** Strip the fields mergeImport intentionally re-mints/remaps on import. */
function stable(record: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _ca, updatedAt: _ua, workspaceId: _wsId, ...rest } = record
  return rest
}

/** Full round trip through the wire format (JSON), not just in-memory objects. */
async function roundTrip(bundle: ExportBundle): Promise<ExportBundle> {
  const json = JSON.stringify(bundle)
  _resetDbSingleton()
  await _clearAllStores()
  resetStores()
  const summary = await mergeImport(
    parseImportBundle(json),
    useEntityStore.getState(),
    useWorkspaceStore.getState()
  )
  void summary
  return parseImportBundle(json) // re-parse for shape assertions below
}

// ---------------------------------------------------------------------------
// Rich fixtures — every optional/nested field populated.
// ---------------------------------------------------------------------------

const richPilotInput = {
  schemaVersion: 1 as const,
  name: 'Odessa Kray',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['first-aid', 'scrounge'],
  equipment: ['sidearm', 'medkit'],
  motto: 'Never look back.',
  keepsake: 'A cracked visor.',
  appearance: 'Scarred, wiry.',
  background: 'Wastes-born.',
  description: 'Quiet, watchful.',
  conditions: ['prone'],
  currentHP: 8,
  currentAP: 2,
  equipmentConditions: { sidearm: 'damaged' as const },
  equipmentChoices: { medkit: { 'bandage-type': ['field-dressing'] } },
  crawlerLevel: 3,
  usedAbilities: ['first-aid'],
  trainingPoints: 2,
  injuries: [{ severity: 'minor' as const, note: 'Twisted ankle.' }],
  maxHpModifier: 2,
  maxApModifier: 1,
  maxInventorySlotsModifier: 4,
  equipmentUses: { medkit: 1 },
  usedToggles: { background: true, keepsake: false, motto: true },
  genericInventory: [{ id: 'gi-1', name: 'Scrap', slotCost: 3, qty: 2, note: 'raw' }],
  lastCriticalInjury: {
    roll: 7,
    outcome: 'minor-injury' as const,
    rolledAt: '2026-01-01T00:00:00.000Z',
  },
}

const richMechInput = {
  schemaVersion: 1 as const,
  name: 'Rustbucket',
  chassisRef: 'iron-mongrel',
  systems: ['welding-rig'],
  modules: ['armor-plating'],
  cargoLots: [
    {
      id: 'lot-unit',
      kind: 'unit' as const,
      name: 'Medkit',
      cat: 'SEALED' as const,
      units: 1,
      code: 'MED',
    },
    {
      id: 'lot-bulk',
      kind: 'bulk' as const,
      name: 'Tech 2 Scrap',
      cat: 'SCRAP' as const,
      tl: 2,
      qty: 3,
      units: 3,
      code: 'SCR-T2',
    },
  ],
  patternName: 'Scout Rig',
  description: 'Rust-streaked hull.',
  conditions: ['vulnerable'],
  maxSpModifier: -5,
  maxEpModifier: 2,
  maxHeatModifier: 1,
  maxCargoModifier: 2,
  currentHP: 4,
  currentAP: 3,
  currentTP: 1,
  currentSP: 6,
  currentEP: 4,
  currentHeat: 5,
  systemConditions: { 'welding-rig': 'damaged' as const },
  moduleConditions: { 'armor-plating': 'intact' as const },
  itemUses: { 'welding-rig': 2 },
  shutdown: true,
  vulnerable: true,
  destroyed: false,
  lastHeatCheck: {
    heatCheckRoll: 12,
    heatAtCheck: 5,
    overloaded: false,
    rolledAt: '2026-01-01T00:00:00.000Z',
  },
  lastCriticalDamage: {
    roll: 15,
    outcome: 'core-damage' as const,
    rolledAt: '2026-01-01T00:00:00.000Z',
  },
}

const richCrawlerInput = {
  schemaVersion: 1 as const,
  name: 'The Rustwalker',
  description: 'A limping veteran crawler.',
  techLevel: 'tech-3',
  type: 'battle-crawler',
  typeNpc: {
    npcName: 'Sergeant Vole',
    npcCurrentHP: 3,
    npcDescription: 'Gravel-voiced.',
    npcFacts: ['Lost an eye at Ashford.'],
    condition: 'damaged' as const,
  },
  crawlerBays: [
    {
      bayRef: 'command-bay',
      npcName: 'Lira',
      npcCurrentHP: 4,
      npcDescription: 'Sharp-eyed.',
      npcFacts: ['Ex-cartographer.'],
      condition: 'intact' as const,
    },
  ],
  systems: ['scanner-array'],
  bayChoices: { 'command-bay': { 'comms-upgrade': ['long-range'] } },
  currentSP: 22,
  scrapPool: { tl1: 3, tl2: 1, tl3: 0 },
  upgradePool: 12,
  cargoLots: [
    {
      id: 'lot-c1',
      kind: 'unit' as const,
      name: 'Spare Parts',
      cat: 'SYSTEM' as const,
      units: 2,
      code: 'SPP',
    },
  ],
  maxSpModifier: 5,
}

const richPatternInput = {
  schemaVersion: 1 as const,
  name: 'Heavy Loadout',
  chassisRef: 'mule-chassis',
  systems: ['sensor-suite', 'long-range-scanner'],
  modules: ['armor-plating'],
  cargoLots: [
    {
      id: 'lot-p1',
      kind: 'bulk' as const,
      name: 'Tech 1 Scrap',
      cat: 'SCRAP' as const,
      tl: 1,
      qty: 5,
      units: 5,
      code: 'SCR-T1',
    },
  ],
}

// ---------------------------------------------------------------------------
// Per-entity round-trip fidelity
// ---------------------------------------------------------------------------

describe('export round-trip — field fidelity', () => {
  test('pilot: every optional/nested field survives buildExportBundle → JSON → parseImportBundle → mergeImport', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    await workspaceStore.hydrate()
    const ws = await workspaceStore.create({ name: 'Campaign Alpha' })

    await entityStore.hydrate('pilot')
    const created = await entityStore.create('pilot', { ...richPilotInput, workspaceId: ws.id })

    const bundle = await buildExportBundle(entityStore, workspaceStore)
    const parsed = await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    const verifyWorkspaceStore = useWorkspaceStore.getState()
    await verifyEntityStore.hydrate('pilot')
    await verifyWorkspaceStore.hydrate()

    const importedPilot = verifyEntityStore.list('pilot')[0]
    const importedWs = verifyWorkspaceStore.list()[0]
    expect(importedPilot).toBeDefined()
    expect(importedWs).toBeDefined()

    // Every field except id/createdAt/updatedAt/workspaceId is preserved exactly.
    expect(stable(importedPilot as unknown as Record<string, unknown>)).toEqual(
      stable(created as unknown as Record<string, unknown>)
    )
    // workspaceId is intentionally remapped — to the NEW workspace's id.
    expect((importedPilot as { workspaceId?: string }).workspaceId).toBe(importedWs!.id)
    expect((importedPilot as { workspaceId?: string }).workspaceId).not.toBe(ws.id)

    // Sanity: the exported bundle actually carried the rich fields (i.e. the
    // round trip exercised them, not an accidentally-empty pilot).
    expect(parsed.entities.pilots[0]?.injuries).toHaveLength(1)
    expect(parsed.entities.pilots[0]?.lastCriticalInjury?.outcome).toBe('minor-injury')
  })

  test('mech: bulk SCRAP + unit cargo lots, condition maps, heat/damage results all survive', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    await entityStore.hydrate('mech')
    const created = await entityStore.create('mech', richMechInput)

    const bundle = await buildExportBundle(entityStore, workspaceStore)
    await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('mech')
    const importedMech = verifyEntityStore.list('mech')[0]
    expect(importedMech).toBeDefined()

    expect(stable(importedMech as unknown as Record<string, unknown>)).toEqual(
      stable(created as unknown as Record<string, unknown>)
    )
  })

  test('crawler: crawlerBays/typeNpc/scrapPool/bayChoices all survive', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    await entityStore.hydrate('crawler')
    const created = await entityStore.create('crawler', richCrawlerInput)

    const bundle = await buildExportBundle(entityStore, workspaceStore)
    await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('crawler')
    const importedCrawler = verifyEntityStore.list('crawler')[0]
    expect(importedCrawler).toBeDefined()

    expect(stable(importedCrawler as unknown as Record<string, unknown>)).toEqual(
      stable(created as unknown as Record<string, unknown>)
    )
  })

  test('mechPattern: bulk SCRAP cargo lot survives (no workspaceId field to remap)', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    const created = await mechPatterns.create(richPatternInput)

    const bundle = await buildExportBundle(entityStore, workspaceStore)
    await roundTrip(bundle)

    const imported = (await mechPatterns.list())[0]
    expect(imported).toBeDefined()

    expect(stable(imported as unknown as Record<string, unknown>)).toEqual(
      stable(created as unknown as Record<string, unknown>)
    )
  })
})

// ---------------------------------------------------------------------------
// Cross-entity fidelity: softLinks + workspace assignment survive together
// in one full-backup round trip (not just each entity type in isolation).
// ---------------------------------------------------------------------------

describe('export round-trip — cross-entity full backup', () => {
  test('pilot + mech + crawler + softLinks + workspace all round-trip consistently', async () => {
    const entityStore = useEntityStore.getState()
    const workspaceStore = useWorkspaceStore.getState()

    await workspaceStore.hydrate()
    const ws = await workspaceStore.create({ name: 'Campaign Alpha' })

    await entityStore.hydrate('pilot')
    const pilot = await entityStore.create('pilot', { ...richPilotInput, workspaceId: ws.id })

    await entityStore.hydrate('mech')
    const mech = await entityStore.create('mech', { ...richMechInput, workspaceId: ws.id })

    await entityStore.hydrate('crawler')
    const crawler = await entityStore.create('crawler', { ...richCrawlerInput, workspaceId: ws.id })

    await entityStore.hydrate('softLink')
    await entityStore.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })
    await entityStore.create('softLink', {
      from: { type: 'pilot', id: pilot.id },
      to: { type: 'crawler', id: crawler.id },
      type: 'pilot-to-crawler',
    })

    await mechPatterns.create(richPatternInput)

    const bundle = await buildExportBundle(entityStore, workspaceStore)
    expect(bundle.entities.pilots).toHaveLength(1)
    expect(bundle.entities.mechs).toHaveLength(1)
    expect(bundle.entities.crawlers).toHaveLength(1)
    expect(bundle.softLinks).toHaveLength(2)
    expect(bundle.workspaces).toHaveLength(1)
    expect(bundle.mechPatterns).toHaveLength(1)

    await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    const verifyWorkspaceStore = useWorkspaceStore.getState()
    await verifyEntityStore.hydrate('pilot')
    await verifyEntityStore.hydrate('mech')
    await verifyEntityStore.hydrate('crawler')
    await verifyEntityStore.hydrate('softLink')
    await verifyWorkspaceStore.hydrate()

    const importedPilot = verifyEntityStore.list('pilot')[0]!
    const importedMech = verifyEntityStore.list('mech')[0]!
    const importedCrawler = verifyEntityStore.list('crawler')[0]!
    const importedLinks = verifyEntityStore.list('softLink')
    const importedWs = verifyWorkspaceStore.list()[0]!
    const importedPatterns = await mechPatterns.list()

    // All three entities re-point at the SAME new workspace id.
    expect((importedPilot as { workspaceId?: string }).workspaceId).toBe(importedWs.id)
    expect((importedMech as { workspaceId?: string }).workspaceId).toBe(importedWs.id)
    expect((importedCrawler as { workspaceId?: string }).workspaceId).toBe(importedWs.id)

    // Both softLinks remapped to the fresh entity ids — no dangling refs.
    expect(importedLinks).toHaveLength(2)
    const mechToPilot = importedLinks.find((l) => l.type === 'mech-to-pilot')!
    const pilotToCrawler = importedLinks.find((l) => l.type === 'pilot-to-crawler')!
    expect(mechToPilot.from.id).toBe(importedMech.id)
    expect(mechToPilot.to.id).toBe(importedPilot.id)
    expect(pilotToCrawler.from.id).toBe(importedPilot.id)
    expect(pilotToCrawler.to.id).toBe(importedCrawler.id)

    // Pattern store survives the same full-backup round trip.
    expect(importedPatterns).toHaveLength(1)
    expect(importedPatterns[0]?.chassisRef).toBe('mule-chassis')

    // Deep field fidelity, same as the per-entity tests above.
    expect(stable(importedPilot as unknown as Record<string, unknown>)).toEqual(
      stable({ ...pilot } as unknown as Record<string, unknown>)
    )
    expect(stable(importedMech as unknown as Record<string, unknown>)).toEqual(
      stable({ ...mech } as unknown as Record<string, unknown>)
    )
    expect(stable(importedCrawler as unknown as Record<string, unknown>)).toEqual(
      stable({ ...crawler } as unknown as Record<string, unknown>)
    )
  })
})
