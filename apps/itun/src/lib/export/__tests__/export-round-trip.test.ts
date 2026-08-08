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
 * re-minted (id, createdAt, updatedAt) and the container (intentionally reset
 * to the importer's Shelf, since Game membership comes from the server rather
 * than from a file — see mergeImport's doc-comment). That reset is exercised
 * explicitly, not treated as noise.
 *
 * No property-testing library (e.g. fast-check) is a dependency of this repo
 * (checked package.json first, per the harness brief) — this is deliberately
 * thorough table-driven coverage instead of generative testing.
 *
 * Formerly a known gap, now fixed: the `encounterNpcs` store previously had
 * NO representation in ExportBundleSchema at all, so a full backup silently
 * omitted GM encounter-tray state. `encounterNpcs` is now part of the bundle
 * (additive `.default([])` field, no schemaVersion bump — see
 * `exportBundle.ts`) and is covered below the same way mechPatterns is.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { useEntityStore } from '../../../stores/entityStore'
import { CONTAINER_MOVE } from '../../../stores/surfaceProvenance'
import { _clearAllStores, _resetDbSingleton, encounterNpcs, mechPatterns } from '../../db/index'
import type { ExportBundle } from '../../schemas/exportBundle'
import { buildExportBundle } from '../buildExportBundle'
import { mergeImport } from '../mergeImport'
import { parseImportBundle } from '../parseImportBundle'

function resetStores(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
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

/** Strip the fields mergeImport intentionally re-mints/remaps on import. */
function stable(record: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    id: _id,
    createdAt: _ca,
    updatedAt: _ua,
    workspaceId: _wsId,
    gameId: _gid,
    ...rest
  } = record
  return rest
}

/** Full round trip through the wire format (JSON), not just in-memory objects. */
async function roundTrip(bundle: ExportBundle): Promise<ExportBundle> {
  const json = JSON.stringify(bundle)
  _resetDbSingleton()
  await _clearAllStores()
  resetStores()
  const summary = await mergeImport(parseImportBundle(json), useEntityStore.getState())
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
  // The bundle must carry a hybrid pilot's origin: it is what decides which of
  // their trees are sealed, and the change log — the only other place a class
  // change is recorded — is local-only and never travels with an export.
  originClassRef: 'hacker',
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

const richEncounterNpcInput = {
  schemaVersion: 1 as const,
  refSchema: 'npcs' as const,
  refSlug: 'wasteland-raider',
  refName: 'Wasteland Raider',
  name: 'Raider 2',
  currentHp: 3,
  maxHp: 6,
  statKind: 'hp' as const,
  conditions: ['bleeding'],
  lastMediatorRoll: {
    table: 'morale' as const,
    roll: 14,
    label: 'Steady',
    value: 'Holds the line.',
    rolledAt: '2026-01-01T00:00:00.000Z',
  },
}

// ---------------------------------------------------------------------------
// Per-entity round-trip fidelity
// ---------------------------------------------------------------------------

describe('export round-trip — field fidelity', () => {
  test('pilot: every optional/nested field survives buildExportBundle → JSON → parseImportBundle → mergeImport', async () => {
    const entityStore = useEntityStore.getState()

    await entityStore.hydrate('pilot')
    const created = await entityStore.create('pilot', { ...richPilotInput, gameId: 'game-alpha' })

    const bundle = await buildExportBundle(entityStore)
    const parsed = await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('pilot')

    const importedPilot = verifyEntityStore.list('pilot')[0]
    expect(importedPilot).toBeDefined()
    if (!importedPilot) throw new Error('expected imported pilot')

    // Every field except id/createdAt/updatedAt/container is preserved exactly.
    expect(stable(importedPilot)).toEqual(stable(created))
    // The container is intentionally NOT carried across: Game membership comes
    // from the server, not from a file, so an import lands on the Shelf.
    expect(importedPilot.gameId).toBeNull()

    // Sanity: the exported bundle actually carried the rich fields (i.e. the
    // round trip exercised them, not an accidentally-empty pilot).
    expect(parsed.entities.pilots[0]?.injuries).toHaveLength(1)
    expect(parsed.entities.pilots[0]?.lastCriticalInjury?.outcome).toBe('minor-injury')
  })

  test('mech: bulk SCRAP + unit cargo lots, condition maps, heat/damage results all survive', async () => {
    const entityStore = useEntityStore.getState()

    await entityStore.hydrate('mech')
    const created = await entityStore.create('mech', richMechInput)

    const bundle = await buildExportBundle(entityStore)
    await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('mech')
    const importedMech = verifyEntityStore.list('mech')[0]
    expect(importedMech).toBeDefined()
    if (!importedMech) throw new Error('expected imported mech')

    expect(stable(importedMech)).toEqual(stable(created))
  })

  test('crawler: crawlerBays/typeNpc/scrapPool/bayChoices all survive', async () => {
    const entityStore = useEntityStore.getState()

    await entityStore.hydrate('crawler')
    const created = await entityStore.create('crawler', richCrawlerInput)

    const bundle = await buildExportBundle(entityStore)
    await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('crawler')
    const importedCrawler = verifyEntityStore.list('crawler')[0]
    expect(importedCrawler).toBeDefined()
    if (!importedCrawler) throw new Error('expected imported crawler')

    expect(stable(importedCrawler)).toEqual(stable(created))
  })

  test('mechPattern: bulk SCRAP cargo lot survives (no workspaceId field to remap)', async () => {
    const entityStore = useEntityStore.getState()

    const created = await mechPatterns.create(richPatternInput)

    const bundle = await buildExportBundle(entityStore)
    await roundTrip(bundle)

    const imported = (await mechPatterns.list())[0]
    expect(imported).toBeDefined()
    if (!imported) throw new Error('expected imported record')

    expect(stable(imported)).toEqual(stable(created))
  })

  test('encounterNpc: conditions + lastMediatorRoll survive, container resets to the Shelf', async () => {
    const entityStore = useEntityStore.getState()

    const created = await encounterNpcs.create({ ...richEncounterNpcInput, gameId: 'game-alpha' })

    const bundle = await buildExportBundle(entityStore)
    expect(bundle.encounterNpcs).toHaveLength(1)
    const parsed = await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const imported = (await encounterNpcs.list())[0]
    expect(imported).toBeDefined()
    if (!imported) throw new Error('expected imported record')

    // Every field except id/createdAt/updatedAt/container is preserved exactly.
    expect(stable(imported)).toEqual(stable(created))
    // The container is not carried across — an import lands on the Shelf.
    expect(imported.gameId).toBeNull()

    // Sanity: the exported bundle actually carried the rich fields.
    expect(parsed.encounterNpcs[0]?.conditions).toEqual(['bleeding'])
    expect(parsed.encounterNpcs[0]?.lastMediatorRoll?.table).toBe('morale')
  })
})

// ---------------------------------------------------------------------------
// Duplicate-skip branches.
//
// mergeImport dedupes on the *incoming* id already existing in the local
// store, so the realistic trigger is re-importing a bundle into the store it
// was exported from (a double-click on Import, or restoring a backup on top
// of live data). Only the pilot and mechPattern skip branches were covered
// before; the mech, crawler, softLink and encounterNpc branches were not,
// and the mech/crawler ones additionally populate `idMap` — a regression
// there mis-wires soft links rather than merely duplicating rows.
// ---------------------------------------------------------------------------

describe('mergeImport — duplicate skip branches', () => {
  test('re-importing a full backup into its own store creates nothing and skips every entity kind', async () => {
    const entityStore = useEntityStore.getState()

    await entityStore.hydrate('pilot')
    const pilot = await entityStore.create('pilot', richPilotInput)
    await entityStore.hydrate('mech')
    const mech = await entityStore.create('mech', richMechInput)
    await entityStore.hydrate('crawler')
    const crawler = await entityStore.create('crawler', richCrawlerInput)

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
    await encounterNpcs.create(richEncounterNpcInput)

    const bundle = await buildExportBundle(entityStore)

    // Import back into the SAME store — every incoming id already exists.
    const summary = await mergeImport(bundle, useEntityStore.getState())

    expect(summary.created).toEqual({
      pilots: 0,
      mechs: 0,
      crawlers: 0,
      softLinks: 0,
      mechPatterns: 0,
      encounterNpcs: 0,
    })
    expect(summary.remappedLinks).toBe(0)
    // 1 pilot + 1 mech + 1 crawler + 2 softLinks + 1 pattern + 1 encounterNpc
    expect(summary.skippedDuplicates).toBe(7)

    // Nothing was duplicated on disk either.
    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('pilot')
    await verifyEntityStore.hydrate('mech')
    await verifyEntityStore.hydrate('crawler')
    await verifyEntityStore.hydrate('softLink')

    expect(verifyEntityStore.list('pilot')).toHaveLength(1)
    expect(verifyEntityStore.list('mech')).toHaveLength(1)
    expect(verifyEntityStore.list('crawler')).toHaveLength(1)
    expect(verifyEntityStore.list('softLink')).toHaveLength(2)
    expect(await mechPatterns.list()).toHaveLength(1)
    expect(await encounterNpcs.list()).toHaveLength(1)
  })

  test('a NEW soft link between already-present endpoints resolves to the existing ids (idMap identity on the skip path)', async () => {
    const entityStore = useEntityStore.getState()

    await entityStore.hydrate('pilot')
    const pilot = await entityStore.create('pilot', richPilotInput)
    await entityStore.hydrate('mech')
    const mech = await entityStore.create('mech', richMechInput)
    await entityStore.hydrate('crawler')
    const crawler = await entityStore.create('crawler', richCrawlerInput)
    await entityStore.hydrate('softLink')

    const exported = await buildExportBundle(entityStore)

    // A bundle carrying the same pilot/mech/crawler (all duplicates) plus one
    // soft link this store has never seen. The mech and crawler skip branches
    // must still register themselves in idMap or these endpoints resolve to
    // undefined and the link is silently dropped.
    const bundle: ExportBundle = {
      ...exported,
      softLinks: [
        {
          id: crypto.randomUUID(),
          from: { type: 'mech', id: mech.id },
          to: { type: 'pilot', id: pilot.id },
          type: 'mech-to-pilot',
          createdAt: FIXTURE_NOW,
        },
        {
          id: crypto.randomUUID(),
          from: { type: 'pilot', id: pilot.id },
          to: { type: 'crawler', id: crawler.id },
          type: 'pilot-to-crawler',
          createdAt: FIXTURE_NOW,
        },
      ],
    }

    const summary = await mergeImport(bundle, useEntityStore.getState())

    // Pilot, mech and crawler skipped; both new links created against the
    // pre-existing ids, so nothing was remapped.
    expect(summary.skippedDuplicates).toBe(3)
    expect(summary.created.softLinks).toBe(2)
    expect(summary.remappedLinks).toBe(0)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('softLink')
    const links = verifyEntityStore.list('softLink')
    expect(links).toHaveLength(2)

    const mechToPilot = links.find((l) => l.type === 'mech-to-pilot')
    const pilotToCrawler = links.find((l) => l.type === 'pilot-to-crawler')
    if (!mechToPilot || !pilotToCrawler) throw new Error('expected both imported soft links')
    expect(mechToPilot.from.id).toBe(mech.id)
    expect(mechToPilot.to.id).toBe(pilot.id)
    expect(pilotToCrawler.from.id).toBe(pilot.id)
    expect(pilotToCrawler.to.id).toBe(crawler.id)
  })
})

// ---------------------------------------------------------------------------
// Cross-entity fidelity: softLinks + container assignment survive together
// in one full-backup round trip (not just each entity type in isolation).
// ---------------------------------------------------------------------------

/**
 * A UUID identifies a sheet; it does not identify a *copy* of one.
 *
 * Two rules follow from that, and they pull in opposite directions, which is
 * why both are pinned here rather than left to the reader:
 *
 *  - **Moving an entity between containers keeps its id.** A Game is a viewport
 *    onto the same sheet, not a duplicate of it, so a move is a patch of
 *    `gameId` and nothing else. (Server-side, `upsertByAppId` re-homes the same
 *    row for the same reason.)
 *  - **Importing an exported bundle mints a new id.** That file may have been
 *    shared, and two people holding the same id is precisely what the server
 *    cannot represent: rows are addressed by `appId`, a duplicate resolves to
 *    the oldest, and the later holder's writes are refused as somebody else's.
 */
describe('identity: what keeps an id and what earns a new one', () => {
  test('moving between containers keeps the id — a game is a viewport, not a copy', async () => {
    const entityStore = useEntityStore.getState()
    await entityStore.hydrate('pilot')
    const pilot = await entityStore.create('pilot', { ...richPilotInput, gameId: null })

    // Same provenance the real control passes, so this exercises the move path
    // rather than a bare patch that happens to touch the same field.
    await entityStore.update('pilot', pilot.id, { gameId: 'game-alpha' }, CONTAINER_MOVE)
    const moved = entityStore.list('pilot').find((p) => p.id === pilot.id)

    expect(moved?.gameId).toBe('game-alpha')
    expect(moved?.id).toBe(pilot.id)
    // And back to the shelf, still the same sheet.
    await entityStore.update('pilot', pilot.id, { gameId: null }, CONTAINER_MOVE)
    expect(entityStore.list('pilot').filter((p) => p.id === pilot.id)).toHaveLength(1)
  })

  test('importing a bundle into a different store mints new ids for everything', async () => {
    const entityStore = useEntityStore.getState()
    await entityStore.hydrate('pilot')
    await entityStore.hydrate('mech')
    const pilot = await entityStore.create('pilot', richPilotInput)
    const mech = await entityStore.create('mech', richMechInput)
    await entityStore.hydrate('softLink')
    await entityStore.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })

    const bundle = await buildExportBundle(entityStore)

    // Somebody else's device: the same file, none of the rows.
    const theirPilots: unknown[] = []
    const theirMechs: unknown[] = []
    const created: Record<string, string[]> = { pilot: [], mech: [], softLink: [] }
    const theirStore = {
      hydrate: async () => {},
      list: (type: string) => (type === 'pilot' ? theirPilots : type === 'mech' ? theirMechs : []),
      create: async (type: string, input: Record<string, unknown>) => {
        const row = { ...input, id: crypto.randomUUID() }
        created[type]?.push(row.id)
        return row
      },
    }

    const summary = await mergeImport(
      bundle,
      theirStore as unknown as Parameters<typeof mergeImport>[1]
    )

    expect(summary.created.pilots).toBe(1)
    expect(summary.created.mechs).toBe(1)
    // Not one id from the file survives into the copy.
    expect(created.pilot).not.toContain(pilot.id)
    expect(created.mech).not.toContain(mech.id)
  })

  test('an imported row does not inherit Starter Set provenance', async () => {
    const entityStore = useEntityStore.getState()
    await entityStore.hydrate('pilot')
    await entityStore.create('pilot', { ...richPilotInput, seedRef: 'starter-pilot-bonesaw' })

    const bundle = await buildExportBundle(entityStore)

    const captured: Record<string, unknown>[] = []
    const theirStore = {
      hydrate: async () => {},
      list: () => [],
      create: async (_type: string, input: Record<string, unknown>) => {
        captured.push(input)
        return { ...input, id: crypto.randomUUID() }
      },
    }
    await mergeImport(bundle, theirStore as unknown as Parameters<typeof mergeImport>[1])

    // Carrying it across would make somebody else's starter pilot read as your
    // own seeded one, and quietly suppress the Starter Set offer.
    expect(captured[0]?.seedRef).toBeUndefined()
  })
})

describe('export round-trip — cross-entity full backup', () => {
  test('pilot + mech + crawler + softLinks + container all round-trip consistently', async () => {
    const entityStore = useEntityStore.getState()

    await entityStore.hydrate('pilot')
    const pilot = await entityStore.create('pilot', { ...richPilotInput, gameId: 'game-alpha' })

    await entityStore.hydrate('mech')
    const mech = await entityStore.create('mech', { ...richMechInput, gameId: 'game-alpha' })

    await entityStore.hydrate('crawler')
    const crawler = await entityStore.create('crawler', {
      ...richCrawlerInput,
      gameId: 'game-alpha',
    })

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
    await encounterNpcs.create({ ...richEncounterNpcInput, gameId: 'game-alpha' })

    const bundle = await buildExportBundle(entityStore)
    expect(bundle.entities.pilots).toHaveLength(1)
    expect(bundle.entities.mechs).toHaveLength(1)
    expect(bundle.entities.crawlers).toHaveLength(1)
    expect(bundle.softLinks).toHaveLength(2)
    // Workspaces are retired: the key survives for old bundles, always empty.
    expect(bundle.workspaces).toHaveLength(0)
    expect(bundle.mechPatterns).toHaveLength(1)
    expect(bundle.encounterNpcs).toHaveLength(1)

    await roundTrip(bundle)

    _resetDbSingleton()
    resetStores()
    const verifyEntityStore = useEntityStore.getState()
    await verifyEntityStore.hydrate('pilot')
    await verifyEntityStore.hydrate('mech')
    await verifyEntityStore.hydrate('crawler')
    await verifyEntityStore.hydrate('softLink')

    const importedPilot = verifyEntityStore.list('pilot')[0]
    const importedMech = verifyEntityStore.list('mech')[0]
    const importedCrawler = verifyEntityStore.list('crawler')[0]
    const importedLinks = verifyEntityStore.list('softLink')
    const importedPatterns = await mechPatterns.list()
    const importedEncounterNpcs = await encounterNpcs.list()
    if (!importedPilot || !importedMech || !importedCrawler) {
      throw new Error('expected imported pilot, mech and crawler')
    }

    // All three land in the SAME container — the importer's Shelf.
    expect(importedPilot.gameId).toBeNull()
    expect(importedMech.gameId).toBeNull()
    expect(importedCrawler.gameId).toBeNull()

    // Both softLinks remapped to the fresh entity ids — no dangling refs.
    expect(importedLinks).toHaveLength(2)
    const mechToPilot = importedLinks.find((l) => l.type === 'mech-to-pilot')
    const pilotToCrawler = importedLinks.find((l) => l.type === 'pilot-to-crawler')
    if (!mechToPilot || !pilotToCrawler) throw new Error('expected both imported soft links')
    expect(mechToPilot.from.id).toBe(importedMech.id)
    expect(mechToPilot.to.id).toBe(importedPilot.id)
    expect(pilotToCrawler.from.id).toBe(importedPilot.id)
    expect(pilotToCrawler.to.id).toBe(importedCrawler.id)

    // Pattern store survives the same full-backup round trip.
    expect(importedPatterns).toHaveLength(1)
    expect(importedPatterns[0]?.chassisRef).toBe('mule-chassis')

    // Encounter NPC survives too, and lands on the same Shelf.
    expect(importedEncounterNpcs).toHaveLength(1)
    expect(importedEncounterNpcs[0]?.refSlug).toBe('wasteland-raider')
    expect(importedEncounterNpcs[0]?.gameId).toBeNull()

    // Deep field fidelity, same as the per-entity tests above.
    expect(stable(importedPilot)).toEqual(stable({ ...pilot }))
    expect(stable(importedMech)).toEqual(stable({ ...mech }))
    expect(stable(importedCrawler)).toEqual(stable({ ...crawler }))
  })
})
