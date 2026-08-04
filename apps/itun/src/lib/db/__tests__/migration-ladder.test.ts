/**
 * Migration ladder harness (durability audit — seeded-fixture coverage).
 *
 * migrations.test.ts already proves a v2-shaped database (mech/pattern with
 * legacy `cargo`, pilot with `rollResults`) migrates cleanly to DB_VERSION.
 * This file exercises the DISTINCT store-creation × rewrite combinations that
 * test does not: a database that starts BEFORE the `mechPatterns` store
 * exists (v1), and one that starts AFTER `mechPatterns` but BEFORE
 * `encounterNpcs` (v4) — plus the v6 slug rewrite's map-rekeying branch
 * (systemConditions/moduleConditions/itemUses), which no existing test
 * exercises.
 *
 * Each fixture is seeded with ONLY the object stores that existed at that
 * real DB_VERSION (mirroring the store-creation branches in ../index.ts),
 * not the full set — a v1 fixture with a `mechPatterns` store already
 * present would silently mask a broken v2 store-creation branch.
 *
 * Isolation: dedicated per-fixture database names, destroyed before/after
 * (see migrations.test.ts's isolation note — the shared app db is never
 * touched here).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { CrawlerSchema } from '../../schemas/crawler'
import { MechSchema } from '../../schemas/mech'
import { MechPatternSchema } from '../../schemas/pattern'
import { PilotSchema } from '../../schemas/pilot'
import { SoftLinkSchema } from '../../schemas/softLink'
import { DB_VERSION, openItunDatabase } from '../index'
import { STORE_NAMES } from '../stores'

const NOW = '2026-01-01T00:00:00.000Z'

/** Delete a dedicated fixture database (never blocks — no other file opens it). */
async function destroyDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error(`deleteDatabase(${name}) blocked`))
  })
}

/**
 * Seed a raw fixture database at a given real DB_VERSION, creating ONLY the
 * object stores that existed at that version (mirroring the store-creation
 * branches in ../index.ts's upgrade callback):
 *   v1: pilots, mechs, crawlers, workspaces, softLinks
 *   v2: + mechPatterns
 *   v5: + encounterNpcs
 * Records are written via raw `db.put` — bypassing Zod entirely, matching
 * what a real old-version browser actually has on disk.
 */
async function seedFixtureDatabase(
  name: string,
  atVersion: number,
  records: { store: string; value: unknown }[]
): Promise<void> {
  const { openDB } = await import('idb')
  const db = await openDB(name, atVersion, {
    upgrade(db) {
      if (atVersion >= 1) {
        for (const storeName of [
          STORE_NAMES.pilots,
          STORE_NAMES.mechs,
          STORE_NAMES.crawlers,
          STORE_NAMES.workspaces,
          STORE_NAMES.softLinks,
        ]) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' })
          }
        }
      }
      if (atVersion >= 2 && !db.objectStoreNames.contains(STORE_NAMES.mechPatterns)) {
        db.createObjectStore(STORE_NAMES.mechPatterns, { keyPath: 'id' })
      }
      if (atVersion >= 5 && !db.objectStoreNames.contains(STORE_NAMES.encounterNpcs)) {
        db.createObjectStore(STORE_NAMES.encounterNpcs, { keyPath: 'id' })
      }
    },
  })
  for (const { store, value } of records) {
    await db.put(store, value)
  }
  db.close()
}

// ---------------------------------------------------------------------------
// Fixture: v1 database (pre-mechPatterns, pre-encounterNpcs, pre-cargoLots,
// pre-slug-refs, pilot still carries rollResults).
// ---------------------------------------------------------------------------

describe('migration ladder: v1 fixture → DB_VERSION', () => {
  const TEST_DB = 'itun-ladder-v1-test'

  beforeEach(async () => {
    await destroyDatabase(TEST_DB)
  })
  afterEach(async () => {
    await destroyDatabase(TEST_DB)
  })

  const v1Pilot = {
    id: 'pilot-v1-1',
    schemaVersion: 1,
    name: 'Vex Bramwell',
    callsign: 'Iron',
    classRef: 'scavenger',
    abilities: ['first-aid'],
    equipment: ['sidearm'],
    rollResults: [],
    motto: 'Never look back.',
    keepsake: 'A cracked visor.',
    appearance: 'Scarred.',
    background: 'Wastes-born.',
    conditions: [],
    currentHP: 9,
    createdAt: NOW,
    updatedAt: NOW,
  }

  const v1Mech = {
    id: 'mech-v1-1',
    schemaVersion: 1,
    name: 'Rustbucket',
    chassisRef: 'Iron Mongrel Chassis',
    systems: ['Welding Rig'],
    modules: ['Armor Plating'],
    cargo: ['Scrap metal', 'Fuel cell'],
    conditions: [],
    currentSP: 6,
    createdAt: NOW,
    updatedAt: NOW,
  }

  const v1Crawler = {
    id: 'crawler-v1-1',
    schemaVersion: 1,
    name: 'The Rustwalker',
    techLevel: 'tech-1',
    systems: ['scanner-array'],
    createdAt: NOW,
    updatedAt: NOW,
  }

  const v1Workspace = {
    id: 'ws-v1-1',
    schemaVersion: 1,
    name: 'Campaign One',
    createdAt: NOW,
  }

  const v1SoftLink = {
    id: 'link-v1-1',
    from: { type: 'mech', id: 'mech-v1-1' },
    to: { type: 'pilot', id: 'pilot-v1-1' },
    type: 'mech-to-pilot',
    createdAt: NOW,
  }

  test('store creation AND record rewrites both apply from a bare v1 database', async () => {
    await seedFixtureDatabase(TEST_DB, 1, [
      { store: STORE_NAMES.pilots, value: v1Pilot },
      { store: STORE_NAMES.mechs, value: v1Mech },
      { store: STORE_NAMES.crawlers, value: v1Crawler },
      { store: STORE_NAMES.workspaces, value: v1Workspace },
      { store: STORE_NAMES.softLinks, value: v1SoftLink },
    ])

    const db = await openItunDatabase(TEST_DB)
    try {
      expect(db.version).toBe(DB_VERSION)

      // Stores that did not exist at v1 must now exist (and be empty — no
      // data was ever written to them, only the ladder created them).
      expect(db.objectStoreNames.contains(STORE_NAMES.mechPatterns)).toBe(true)
      expect(db.objectStoreNames.contains(STORE_NAMES.encounterNpcs)).toBe(true)
      expect(await db.count(STORE_NAMES.mechPatterns)).toBe(0)
      expect(await db.count(STORE_NAMES.encounterNpcs)).toBe(0)

      // Pilot: v4 rewrite dropped rollResults; strict-parses.
      const rawPilot = await db.get(STORE_NAMES.pilots, 'pilot-v1-1')
      expect('rollResults' in (rawPilot as Record<string, unknown>)).toBe(false)
      const pilot = PilotSchema.parse(rawPilot)
      expect(pilot.abilities).toEqual(['first-aid'])
      expect(pilot.currentHP).toBe(9)

      // Mech: v3 cargo→cargoLots AND v6 name→slug both applied.
      const mech = MechSchema.parse(await db.get(STORE_NAMES.mechs, 'mech-v1-1'))
      expect(mech.cargoLots.map((l) => l.name)).toEqual(['Scrap metal', 'Fuel cell'])
      expect(mech.chassisRef).toBe('iron-mongrel-chassis')
      expect(mech.systems).toEqual(['welding-rig'])
      expect(mech.modules).toEqual(['armor-plating'])
      expect(mech.currentSP).toBe(6)

      // Crawler/workspace/softLink: no rewrite touches these shapes — data
      // survives the ladder untouched and still strict-parses.
      const crawler = CrawlerSchema.parse(await db.get(STORE_NAMES.crawlers, 'crawler-v1-1'))
      expect(crawler.name).toBe('The Rustwalker')
      expect(crawler.systems).toEqual(['scanner-array'])

      // Workspaces are retired (ADR-030 §2), so there is no schema to parse
      // against any more — but the ROW must still survive the ladder, because
      // migration v13 reads `workspaceId` off entities that v10 wrote here.
      const workspace = (await db.get(STORE_NAMES.workspaces, 'ws-v1-1')) as
        | { name: string }
        | undefined
      expect(workspace?.name).toBe('Campaign One')

      const link = SoftLinkSchema.parse(await db.get(STORE_NAMES.softLinks, 'link-v1-1'))
      expect(link.from.id).toBe('mech-v1-1')
      expect(link.to.id).toBe('pilot-v1-1')
    } finally {
      db.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Fixture: v4 database (mechPatterns store exists; encounterNpcs does not;
// cargo already rewritten to cargoLots and rollResults already dropped; refs
// still name-based — including systemConditions/moduleConditions/itemUses
// map KEYS, which no other test exercises).
// ---------------------------------------------------------------------------

describe('migration ladder: v4 fixture → DB_VERSION', () => {
  const TEST_DB = 'itun-ladder-v4-test'

  beforeEach(async () => {
    await destroyDatabase(TEST_DB)
  })
  afterEach(async () => {
    await destroyDatabase(TEST_DB)
  })

  const v4Pilot = {
    id: 'pilot-v4-1',
    schemaVersion: 1,
    name: 'Odessa Kray',
    callsign: 'Ghost',
    classRef: 'scavenger',
    abilities: ['a-1'],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
  }

  const v4Mech = {
    id: 'mech-v4-1',
    schemaVersion: 1,
    name: 'Old Guard',
    chassisRef: 'Ghost Chassis',
    systems: ['Sensor Suite'],
    modules: ['Reactive Armor'],
    cargoLots: [
      { id: 'lot-a', kind: 'unit', name: 'Medkit', cat: 'SEALED', units: 1, code: 'MED' },
    ],
    conditions: [],
    systemConditions: { 'Sensor Suite': 'damaged' },
    moduleConditions: { 'Reactive Armor': 'intact' },
    itemUses: { 'Sensor Suite': 2 },
    createdAt: NOW,
    updatedAt: NOW,
  }

  const v4Pattern = {
    id: 'pattern-v4-1',
    schemaVersion: 1,
    name: 'Recon Loadout',
    chassisRef: 'Mule Chassis',
    systems: ['Long Range Scanner'],
    modules: [],
    cargoLots: [],
    createdAt: NOW,
  }

  test('encounterNpcs store is created AND v6 map-rekeying applies from a v4 database', async () => {
    await seedFixtureDatabase(TEST_DB, 4, [
      { store: STORE_NAMES.pilots, value: v4Pilot },
      { store: STORE_NAMES.mechs, value: v4Mech },
      { store: STORE_NAMES.mechPatterns, value: v4Pattern },
    ])

    const db = await openItunDatabase(TEST_DB)
    try {
      expect(db.version).toBe(DB_VERSION)

      // encounterNpcs did NOT exist at v4 — the ladder must create it.
      expect(db.objectStoreNames.contains(STORE_NAMES.encounterNpcs)).toBe(true)
      expect(await db.count(STORE_NAMES.encounterNpcs)).toBe(0)

      // Pilot already post-v4 (no rollResults) — passes through unchanged.
      const pilot = PilotSchema.parse(await db.get(STORE_NAMES.pilots, 'pilot-v4-1'))
      expect(pilot.name).toBe('Odessa Kray')

      // Mech: already cargoLots-shaped (v3 no-op), but refs AND condition-map
      // keys are still names — v6 must slugify both the ref arrays and the
      // systemConditions/moduleConditions/itemUses map keys.
      const mech = MechSchema.parse(await db.get(STORE_NAMES.mechs, 'mech-v4-1'))
      expect(mech.chassisRef).toBe('ghost-chassis')
      expect(mech.systems).toEqual(['sensor-suite'])
      expect(mech.modules).toEqual(['reactive-armor'])
      expect(mech.systemConditions).toEqual({ 'sensor-suite': 'damaged' })
      expect(mech.moduleConditions).toEqual({ 'reactive-armor': 'intact' })
      expect(mech.itemUses).toEqual({ 'sensor-suite': 2 })
      // Cargo lot untouched by v3 (already cargoLots-shaped) — not re-wrapped.
      expect(mech.cargoLots).toHaveLength(1)
      expect(mech.cargoLots[0]?.name).toBe('Medkit')

      // Pattern store already existed at v4 — same v6 rewrite applies there.
      const pattern = MechPatternSchema.parse(
        await db.get(STORE_NAMES.mechPatterns, 'pattern-v4-1')
      )
      expect(pattern.chassisRef).toBe('mule-chassis')
      expect(pattern.systems).toEqual(['long-range-scanner'])
    } finally {
      db.close()
    }
  })
})
