/**
 * THROWAWAY DEV SCAFFOLD — Slice G (#239).
 *
 * Idempotent dev seed that writes a fully-populated SAMPLE set into the local
 * IndexedDB store so a human can click through every major flow with realistic
 * data. NOT shipped: this module is only ever imported from the dev-only `/dev`
 * route behind `import.meta.env.DEV`, and from the `.helper.ts` capture script.
 *
 * >>> REMOVAL NOTE (delete before #239 merges): remove this entire `scaffold/`
 * >>> directory and the `src/routes/dev.tsx` dev-only route. Nothing in the
 * >>> shipped app imports from here.
 *
 * Why direct IDB writes (not entityStore.create):
 *   The db CRUD layer always injects a random UUID, so re-running create()
 *   would pile up duplicate sample entities. We instead `db.put()` with STABLE
 *   ids (SEED_IDS) after validating against the same Zod schemas the CRUD layer
 *   uses — so a re-seed overwrites the previous sample set in place.
 */

import { SalvageUnionReference } from 'salvageunion-reference'

import { getDb } from '../src/lib/db'

import { CrawlerSchema, type Crawler } from '../src/lib/schemas/crawler'
import { MechSchema, type Mech } from '../src/lib/schemas/mech'
import { PilotSchema, type Pilot } from '../src/lib/schemas/pilot'
import { SoftLinkSchema, type SoftLink } from '../src/lib/schemas/softLink'
import { STORE_NAMES } from '../src/lib/db/stores'
import { useEntityStore } from '../src/stores/entityStore'
import { SEED_IDS } from './seedIds'

// Re-exported for convenience; canonical definition lives in seedIds.ts so the
// dev route can import the ids without pulling this heavy module into prod.
export { SEED_IDS }

// ---------------------------------------------------------------------------
// Reference-data resolution helpers
// ---------------------------------------------------------------------------

// The reference models expose `.all()` once preloaded. We keep these loose
// because the seed only reads a few well-known fields.
type RefEntity = { id: string; name: string; choices?: { id: string }[] }

function byName<T extends RefEntity>(all: readonly T[], name: string): T | undefined {
  return all.find((e) => e.name === name)
}

/**
 * Resolves the sample reference entities, preferring well-known names but
 * falling back to "first available" so the seed never throws if a name drifts.
 */
function resolveRefs() {
  const equipment = SalvageUnionReference.Equipment.all() as unknown as RefEntity[]
  const abilities = SalvageUnionReference.Abilities.all() as unknown as RefEntity[]
  const systems = SalvageUnionReference.Systems.all() as unknown as RefEntity[]
  const modules = SalvageUnionReference.Modules.all() as unknown as RefEntity[]
  const chassis = SalvageUnionReference.Chassis.all() as unknown as RefEntity[]
  const bays = SalvageUnionReference.CrawlerBays.all() as unknown as RefEntity[]

  // Equipment that carries `choices` (e.g. Custom Sniper Rifle → Weapon Type).
  const choiceEquip =
    byName(equipment, 'Custom Sniper Rifle') ??
    equipment.find((e) => (e.choices?.length ?? 0) > 0) ??
    equipment[0]
  const plainEquip =
    byName(equipment, 'First Aid Kit') ??
    equipment.find((e) => e.id !== choiceEquip?.id) ??
    equipment[1]

  const sniperWeaponType =
    choiceEquip?.choices?.find((c) => c.id === 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a') ??
    choiceEquip?.choices?.[0]

  const ability1 = abilities[0]
  const ability2 = abilities[1]

  const sampleChassis = byName(chassis, 'Mule') ?? chassis[0]
  const system1 = byName(systems, '.50 Cal Machine Gun') ?? systems[0]
  const system2 = byName(systems, 'Armour Plating') ?? systems[1]
  const moduleA = byName(modules, 'Comms Module') ?? modules[0]

  const commandBay = byName(bays, 'Command Bay') ?? bays[0]
  const mechBay = byName(bays, 'Mech Bay') ?? bays[1]
  const armamentBay = byName(bays, 'Armament Bay') ?? bays.find((b) => (b.choices?.length ?? 0) > 0)

  return {
    choiceEquip,
    plainEquip,
    sniperWeaponType,
    ability1,
    ability2,
    sampleChassis,
    system1,
    system2,
    moduleA,
    commandBay,
    mechBay,
    armamentBay,
  }
}

// ---------------------------------------------------------------------------
// Sample entity builders
// ---------------------------------------------------------------------------

function buildPilot(now: string, refs: ReturnType<typeof resolveRefs>): Pilot {
  const equipment = [refs.choiceEquip?.id, refs.plainEquip?.id].filter((x): x is string =>
    Boolean(x)
  )
  const abilities = [refs.ability1?.id, refs.ability2?.id].filter((x): x is string => Boolean(x))

  const equipmentChoices: Pilot['equipmentChoices'] = {}
  if (refs.choiceEquip?.id && refs.sniperWeaponType?.id) {
    equipmentChoices[refs.choiceEquip.id] = {
      [refs.sniperWeaponType.id]: ['Ballistic'],
    }
  }

  return PilotSchema.parse({
    id: SEED_IDS.pilot,
    schemaVersion: 1,
    name: 'Vex Calloway',
    callsign: 'Rust',
    classRef: 'scavenger',
    abilities,
    equipment,
    rollResults: ['Injury: Cracked Ribs (Severe)'],
    motto: 'Salvage first, ask later.',
    keepsake: 'A dented dog tag from the old crawler.',
    appearance: 'Wiry, soot-streaked, a welding visor pushed up on the forehead.',
    background: 'Grew up scavenging the Deep Wastes after the Hamlet fell.',
    conditions: ['Exhausted'],
    currentHP: 6,
    currentAP: 4,
    equipmentConditions: refs.plainEquip?.id ? { [refs.plainEquip.id]: 'damaged' as const } : {},
    ...(Object.keys(equipmentChoices).length > 0 ? { equipmentChoices } : {}),
    crawlerLevel: 3,
    usedAbilities: abilities[0] ? [abilities[0]] : [],
    createdAt: now,
    updatedAt: now,
  })
}

function buildMech(now: string, refs: ReturnType<typeof resolveRefs>): Mech {
  const systems = [refs.system1?.id, refs.system2?.id].filter((x): x is string => Boolean(x))
  const modules = [refs.moduleA?.id].filter((x): x is string => Boolean(x))

  const systemConditions: Mech['systemConditions'] = {}
  if (refs.system1?.id) systemConditions[refs.system1.id] = 'damaged'
  if (refs.system2?.id) systemConditions[refs.system2.id] = 'destroyed'

  const moduleConditions: Mech['moduleConditions'] = {}
  if (refs.moduleA?.id) moduleConditions[refs.moduleA.id] = 'intact'

  return MechSchema.parse({
    id: SEED_IDS.mech,
    schemaVersion: 1,
    name: 'Iron Mongrel',
    // MechSheet resolves chassis by NAME (chassisRef === chassis.name).
    chassisRef: refs.sampleChassis?.name ?? 'Mule',
    systems,
    modules,
    cargoLots: [],
    patternName: 'Wasteland Ochre',
    conditions: ['Vulnerable'],
    // Near-cap live values so steppers / Heat Check controls show interesting state.
    currentSP: 2,
    currentEP: 1,
    currentHeat: 5,
    systemConditions,
    moduleConditions,
    lastHeatCheck: {
      heatCheckRoll: 4,
      heatAtCheck: 5,
      overloaded: true,
      overloadRoll: 8,
      outcome: 'module-destroyed' as const,
      rolledAt: now,
    },
    createdAt: now,
    updatedAt: now,
  })
}

function buildCrawler(now: string, refs: ReturnType<typeof resolveRefs>): Crawler {
  const bays: NonNullable<Crawler['crawlerBays']> = []
  if (refs.commandBay) {
    bays.push({
      bayRef: refs.commandBay.id,
      npcName: 'Marshal Okonkwo',
      npcCurrentHP: 4,
      npcDescription: 'Steel-haired commander who runs the bridge with quiet authority.',
      npcFacts: ['Lost an arm at the Siege of Kettle', 'Keeps a caged songbird on the bridge'],
    })
  }
  if (refs.mechBay) {
    bays.push({
      bayRef: refs.mechBay.id,
      npcName: 'Greaser Pyne',
      npcCurrentHP: 2,
      npcDescription: 'Perpetually oil-stained mech-wright who hums while welding.',
      npcFacts: ['Owes the cantina three weeks of rations'],
    })
  }
  if (refs.armamentBay) {
    bays.push({
      bayRef: refs.armamentBay.id,
      npcName: 'Quartermaster Vash',
      npcCurrentHP: 4,
      npcDescription: 'Counts every shell twice and trusts no one near the racks.',
      npcFacts: ['Hoards pre-Fall ammunition'],
    })
  }

  return CrawlerSchema.parse({
    id: SEED_IDS.crawler,
    schemaVersion: 1,
    name: 'The Wandering Kettle',
    techLevel: 'tech-3',
    crawlerBays: bays,
    systems: [],
    currentSP: 22,
    createdAt: now,
    updatedAt: now,
  })
}

function buildSoftLinks(now: string): SoftLink[] {
  return [
    SoftLinkSchema.parse({
      id: SEED_IDS.linkMechPilot,
      from: { type: 'mech', id: SEED_IDS.mech },
      to: { type: 'pilot', id: SEED_IDS.pilot },
      type: 'mech-to-pilot',
      createdAt: now,
    }),
    SoftLinkSchema.parse({
      id: SEED_IDS.linkPilotCrawler,
      from: { type: 'pilot', id: SEED_IDS.pilot },
      to: { type: 'crawler', id: SEED_IDS.crawler },
      type: 'pilot-to-crawler',
      createdAt: now,
    }),
  ]
}

// ---------------------------------------------------------------------------
// Seed entry point
// ---------------------------------------------------------------------------

export type SeedResult = {
  pilotId: string
  mechId: string
  crawlerId: string
}

/**
 * Writes the sample set to IndexedDB (idempotent — stable ids, put overwrites)
 * and resets the in-memory entity store so the next read re-hydrates from disk.
 *
 * Requires the reference data to be preloaded (the app's GameDataReady gate
 * ensures this on every route; the capture script seeds after that gate).
 */
export async function seedSampleData(): Promise<SeedResult> {
  const now = new Date().toISOString()
  const refs = resolveRefs()

  const pilot = buildPilot(now, refs)
  const mech = buildMech(now, refs)
  const crawler = buildCrawler(now, refs)
  const softLinks = buildSoftLinks(now)

  // Use the app's canonical opener so the `upgrade` that creates the object
  // stores has run (a bare openDB on a fresh DB yields no stores). Do NOT close
  // it — it is the app-wide singleton connection.
  const db = await getDb()
  const tx = db.transaction(
    [STORE_NAMES.pilots, STORE_NAMES.mechs, STORE_NAMES.crawlers, STORE_NAMES.softLinks],
    'readwrite'
  )
  await Promise.all([
    tx.objectStore(STORE_NAMES.pilots).put(pilot),
    tx.objectStore(STORE_NAMES.mechs).put(mech),
    tx.objectStore(STORE_NAMES.crawlers).put(crawler),
    ...softLinks.map((link) => tx.objectStore(STORE_NAMES.softLinks).put(link)),
  ])
  await tx.done

  // Force the Zustand store to re-read from disk on next list()/get().
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  await Promise.all([
    useEntityStore.getState().hydrate('pilot'),
    useEntityStore.getState().hydrate('mech'),
    useEntityStore.getState().hydrate('crawler'),
    useEntityStore.getState().hydrate('softLink'),
  ])

  return { pilotId: pilot.id, mechId: mech.id, crawlerId: crawler.id }
}
