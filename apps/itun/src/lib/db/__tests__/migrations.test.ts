/**
 * Migration framework tests (plan 2.1/2.10, R2).
 *
 * The load-bearing case: a DB-version-2-shaped database (mech + pattern
 * records carrying the legacy `cargo: string[]` field) opened through the
 * canonical openItunDatabase() upgrade path comes out at DB_VERSION with
 * cargo rewritten to `cargoLots` — and every record still strict-parses
 * through the current Zod schemas.
 *
 * Isolation: these tests run against a DEDICATED database name. The shared
 * app database stays untouched — deleting it here would block on connections
 * other test files leave open (deleteDatabase blocks while any connection is
 * alive), wedging the whole suite.
 *
 * Salvage-path read tests live here too; they use the shared db accessors
 * (no version games, no deletes — safe to share).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME } from '../../defaultWorkspace'
import { MechPatternSchema } from '../../schemas/pattern'
import { MechSchema } from '../../schemas/mech'
import { PilotSchema } from '../../schemas/pilot'
import { DB_VERSION, _clearAllStores, openItunDatabase, pilots } from '../index'
import { STORE_NAMES } from '../stores'
import { must } from '../../../components/__tests__/must'

const TEST_DB_NAME = 'itun-migrations-test'

/** Delete the dedicated test database (no other file opens it — never blocks). */
async function destroyTestDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(TEST_DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('deleteDatabase blocked — a connection is still open'))
  })
}

/**
 * Create a DB-version-2 database with the v1/v2 object stores and seed it
 * with raw v2-shaped records (bypassing Zod — this is what real users' disks
 * contain).
 */
async function seedV2Database(records: { store: string; value: unknown }[]): Promise<void> {
  const { openDB } = await import('idb')
  const db = await openDB(TEST_DB_NAME, 2, {
    upgrade(db) {
      for (const storeName of Object.values(STORE_NAMES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    },
  })
  for (const { store, value } of records) {
    await db.put(store, value)
  }
  db.close()
}

const NOW = '2026-01-01T00:00:00.000Z'

const v2Mech = {
  id: 'mech-v2-1',
  schemaVersion: 1,
  name: 'Old Mongrel',
  chassisRef: 'Iron Mongrel Chassis',
  systems: ['welding-rig'],
  modules: ['armor-plating'],
  cargo: ['Salvaged plating', 'ration-pack'],
  conditions: [],
  currentSP: 8,
  createdAt: NOW,
  updatedAt: NOW,
}

const v2Pattern = {
  id: 'pattern-v2-1',
  schemaVersion: 1,
  name: 'Old Loadout',
  chassisRef: 'Iron Mongrel Chassis',
  systems: [],
  modules: [],
  cargo: ['fuel-cell'],
  createdAt: NOW,
}

const v2Pilot = {
  id: 'pilot-v2-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['a-1', 'a-2', 'a-3'],
  equipment: [],
  rollResults: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  currentHP: 10,
  createdAt: NOW,
  updatedAt: NOW,
}

describe('v2 → current migrations (v3 cargo → cargoLots, v4 rollResults removal)', () => {
  beforeEach(async () => {
    await destroyTestDatabase()
  })

  afterEach(async () => {
    await destroyTestDatabase()
  })

  test('a v2-shaped database loads through the canonical opener with cargo rewritten', async () => {
    await seedV2Database([
      { store: STORE_NAMES.mechs, value: v2Mech },
      { store: STORE_NAMES.mechPatterns, value: v2Pattern },
      { store: STORE_NAMES.pilots, value: v2Pilot },
    ])

    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(db.version).toBe(DB_VERSION)

      // Mech: legacy cargo strings became 1-unit SEALED unit-lots; the
      // record strict-parses through the current MechSchema.
      const mech = MechSchema.parse(await db.get(STORE_NAMES.mechs, 'mech-v2-1'))
      expect(mech.cargoLots).toHaveLength(2)
      expect(mech.cargoLots.map((l) => l.name)).toEqual(['Salvaged plating', 'ration-pack'])
      for (const lot of mech.cargoLots) {
        expect(lot.kind).toBe('unit')
        expect(lot.cat).toBe('SEALED')
        expect(lot.units).toBe(1)
        expect(typeof lot.id).toBe('string')
        expect(lot.code.length).toBeGreaterThan(0)
      }
      expect('cargo' in mech).toBe(false)
      // Untouched live state survives the rewrite.
      expect(mech.currentSP).toBe(8)

      // v6: name-based refs came out as slugs (systems/modules were already
      // slug-shaped, so they pass through unchanged — slugify is idempotent).
      expect(mech.chassisRef).toBe('iron-mongrel-chassis')
      expect(mech.systems).toEqual(['welding-rig'])
      expect(mech.modules).toEqual(['armor-plating'])

      // Pattern store gets the same rewrite.
      const pattern = MechPatternSchema.parse(
        await db.get(STORE_NAMES.mechPatterns, 'pattern-v2-1')
      )
      expect(pattern.cargoLots.map((l) => l.name)).toEqual(['fuel-cell'])
      expect(pattern.chassisRef).toBe('iron-mongrel-chassis')

      // Pilot: v4 drops the vestigial `rollResults` field the v2 record
      // carries; the rewritten record strict-parses, new optional fields
      // simply read absent.
      const rawPilot = await db.get(STORE_NAMES.pilots, 'pilot-v2-1')
      expect('rollResults' in (rawPilot as Record<string, unknown>)).toBe(false)
      const pilot = PilotSchema.parse(rawPilot)
      expect(pilot.abilities).toEqual(['a-1', 'a-2', 'a-3'])
      expect(pilot.trainingPoints).toBeUndefined()
    } finally {
      db.close()
    }
  })

  test('a fresh database opens directly at DB_VERSION with all stores', async () => {
    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(db.version).toBe(DB_VERSION)
      for (const storeName of Object.values(STORE_NAMES)) {
        expect(db.objectStoreNames.contains(storeName)).toBe(true)
      }
    } finally {
      db.close()
    }
  })

  test('a migration that throws aborts the upgrade and rejects openItunDatabase', async () => {
    // Silence the intentional console.error the failure path emits.
    const originalError = console.error
    console.error = () => {}
    try {
      await expect(
        openItunDatabase(TEST_DB_NAME, async () => {
          throw new Error('boom — simulated migration failure')
        })
      ).rejects.toThrow()
    } finally {
      console.error = originalError
    }
  })

  test('a failed migration does not commit the version bump — a clean reopen still migrates', async () => {
    // Seed a v2-shaped database (version 2, legacy cargo on disk).
    await seedV2Database([{ store: STORE_NAMES.mechs, value: v2Mech }])

    // First open at DB_VERSION with a throwing migration: the versionchange
    // transaction aborts, so the bump to DB_VERSION must NOT commit.
    const originalError = console.error
    console.error = () => {}
    try {
      await expect(
        openItunDatabase(TEST_DB_NAME, async () => {
          throw new Error('boom')
        })
      ).rejects.toThrow()
    } finally {
      console.error = originalError
    }

    // A second, clean open (real migrations) must succeed from the still-v2
    // database and rewrite cargo → cargoLots. If the failed attempt had
    // half-committed the version bump, this record would never be migrated.
    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(db.version).toBe(DB_VERSION)
      const mech = MechSchema.parse(await db.get(STORE_NAMES.mechs, 'mech-v2-1'))
      expect(mech.cargoLots.map((l) => l.name)).toEqual(['Salvaged plating', 'ration-pack'])
      expect('cargo' in mech).toBe(false)
    } finally {
      db.close()
    }
  })

  test('records already shaped as cargoLots are not double-converted', async () => {
    const lots = [
      {
        id: 'lot-1',
        kind: 'bulk',
        name: 'Tech 2 Scrap',
        cat: 'SCRAP',
        tl: 2,
        qty: 3,
        units: 3,
        code: 'SCR-T2',
      },
    ]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cargo: _legacyCargo, ...mechWithoutCargo } = v2Mech
    await seedV2Database([
      {
        store: STORE_NAMES.mechs,
        value: { ...mechWithoutCargo, id: 'mech-modern', cargoLots: lots },
      },
    ])

    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      const mech = MechSchema.parse(await db.get(STORE_NAMES.mechs, 'mech-modern'))
      expect(mech.cargoLots).toEqual(lots as typeof mech.cargoLots)
    } finally {
      db.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Salvage read path — uses the SHARED db (no deletes, no version games).
// ---------------------------------------------------------------------------

describe('salvage read path', () => {
  beforeEach(async () => {
    await _clearAllStores()
  })

  afterEach(async () => {
    await _clearAllStores()
  })

  test('a drifted record (unknown field) is stripped with a console warning, not a brick', async () => {
    // getDb is module-private — raw writes use a second connection to the
    // same shared app database via the canonical opener.
    const db = await openItunDatabase()
    // Simulate version skew: a record written by some other build with a
    // field the current strict schema does not know.
    await db.put(STORE_NAMES.pilots, {
      ...v2Pilot,
      id: 'pilot-drifted',
      fieldFromTheFuture: 'whatever',
    })
    db.close()

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    }
    try {
      const record = await pilots.get('pilot-drifted')
      expect(record).not.toBeNull()
      expect('fieldFromTheFuture' in must(record)).toBe(false)

      // list() hydration also survives — the drifted record is included.
      const all = await pilots.list()
      expect(all.some((p) => p.id === 'pilot-drifted')).toBe(true)

      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
    } finally {
      console.warn = originalWarn
    }
  })

  test('an unreadable record is skipped (with a warning) instead of failing the whole list', async () => {
    const db = await openItunDatabase()
    await pilots.create({
      schemaVersion: 1,
      name: 'Good Pilot',
      callsign: 'OK',
      classRef: 'scavenger',
      abilities: [],
      equipment: [],
      motto: '',
      keepsake: '',
      appearance: '',
      background: '',
      conditions: [],
    })
    // Garbage beyond salvage: required fields missing entirely.
    await db.put(STORE_NAMES.pilots, { id: 'pilot-garbage', createdAt: NOW })
    db.close()

    const originalWarn = console.warn
    console.warn = () => {}
    try {
      const all = await pilots.list()
      expect(all.some((p) => p.name === 'Good Pilot')).toBe(true)
      expect(all.some((p) => p.id === 'pilot-garbage')).toBe(false)
    } finally {
      console.warn = originalWarn
    }
  })

  test('a drifted record heals on its next write (strict shape persisted)', async () => {
    const db = await openItunDatabase()
    try {
      await db.put(STORE_NAMES.pilots, {
        ...v2Pilot,
        id: 'pilot-heal',
        fieldFromTheFuture: true,
      })

      const originalWarn = console.warn
      console.warn = () => {}
      try {
        await pilots.update('pilot-heal', { motto: 'Healed.' })
      } finally {
        console.warn = originalWarn
      }

      const raw = await db.get(STORE_NAMES.pilots, 'pilot-heal')
      expect('fieldFromTheFuture' in (raw as Record<string, unknown>)).toBe(false)
      expect((raw as Record<string, unknown>).motto).toBe('Healed.')
    } finally {
      db.close()
    }
  })
})

describe('v10 — Default workspace seed + backfill', () => {
  beforeEach(async () => {
    await destroyTestDatabase()
  })

  afterEach(async () => {
    await destroyTestDatabase()
  })

  test('creates the Default workspace and backfills only unassigned builds', async () => {
    // Two builds with NO workspaceId (should be backfilled) and one already
    // assigned to another workspace (must be left untouched).
    const unassignedMech = { ...v2Mech, id: 'mech-unassigned' }
    const unassignedPilot = { ...v2Pilot, id: 'pilot-unassigned' }
    const assignedPilot = {
      ...v2Pilot,
      id: 'pilot-assigned',
      workspaceId: 'starter-set-workspace',
    }
    await seedV2Database([
      { store: STORE_NAMES.mechs, value: unassignedMech },
      { store: STORE_NAMES.pilots, value: unassignedPilot },
      { store: STORE_NAMES.pilots, value: assignedPilot },
    ])

    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(db.version).toBe(DB_VERSION)

      // The Default workspace record now exists.
      const ws = (await db.get(STORE_NAMES.workspaces, DEFAULT_WORKSPACE_ID)) as
        | { id: string; name: string }
        | undefined
      expect(ws?.id).toBe(DEFAULT_WORKSPACE_ID)
      expect(ws?.name).toBe(DEFAULT_WORKSPACE_NAME)

      // Unassigned builds were moved into Default (and still strict-parse).
      const mech = MechSchema.parse(await db.get(STORE_NAMES.mechs, 'mech-unassigned'))
      expect(mech.workspaceId).toBe(DEFAULT_WORKSPACE_ID)
      const pilot = PilotSchema.parse(await db.get(STORE_NAMES.pilots, 'pilot-unassigned'))
      expect(pilot.workspaceId).toBe(DEFAULT_WORKSPACE_ID)

      // A build already in another workspace is untouched.
      const kept = PilotSchema.parse(await db.get(STORE_NAMES.pilots, 'pilot-assigned'))
      expect(kept.workspaceId).toBe('starter-set-workspace')
    } finally {
      db.close()
    }
  })

  test('a fresh database opens with the Default workspace already present', async () => {
    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      const ws = (await db.get(STORE_NAMES.workspaces, DEFAULT_WORKSPACE_ID)) as
        | { id: string }
        | undefined
      expect(ws?.id).toBe(DEFAULT_WORKSPACE_ID)
    } finally {
      db.close()
    }
  })
})
