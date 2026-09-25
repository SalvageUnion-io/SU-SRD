/**
 * The retired `Pilot.equipmentLoadouts` field (audit AP-18).
 *
 * v11 lifted every slug-keyed loadout into `partners` and left the key on the
 * row, because the strict schema still declared it. The field is gone from the
 * schema now, so three things must hold or a stored pilot stops parsing:
 *
 *  1. `normalizeLegacyPilotRecord` drops the key — and lifts it into
 *     `partners` first when a record never went through v11 (a pre-v11
 *     export), so loadouts are never silently lost.
 *  2. `StoredPilotSchema` — the Convex edge parse — accepts a row that still
 *     carries it.
 *  3. v16 deletes it from local rows, and the pilots store heals any it still
 *     meets (a row cached from Convex) without falling back to salvage.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { normalizeLegacyPilotRecord, PilotSchema, StoredPilotSchema } from '../../schemas/pilot'
import { DB_VERSION, openItunDatabase } from '../index'
import { STORE_NAMES } from '../stores'

const NOW = '2026-01-01T00:00:00.000Z'

const PARTNER = {
  id: 'partner-1',
  hostRef: 'survey-drone',
  hostSchema: 'equipment' as const,
  systems: [],
  modules: [],
  conditions: [],
}

/** A valid current pilot, plus whatever legacy keys a test layers on. */
function pilot(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pilot-1',
    schemaVersion: 1,
    name: 'Yara Voss',
    callsign: 'Ghost',
    classRef: 'scavenger',
    abilities: [],
    equipment: ['survey-drone'],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    currentHP: 10,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

/** What v11 left behind: partners lifted, the old key still on the row. */
const postV11 = () =>
  pilot({
    partners: [PARTNER],
    equipmentLoadouts: { 'survey-drone': { systems: [], modules: [] } },
  })

describe('normalizeLegacyPilotRecord', () => {
  test('drops the key and keeps the partners v11 already lifted', () => {
    const next = normalizeLegacyPilotRecord(postV11())
    expect('equipmentLoadouts' in next).toBe(false)
    expect(next.partners).toEqual([PARTNER])
  })

  test('lifts a never-migrated loadout into partners rather than losing it', () => {
    const next = normalizeLegacyPilotRecord(
      pilot({ equipmentLoadouts: { 'survey-drone': { systems: ['s-1'], modules: [] } } })
    )
    expect('equipmentLoadouts' in next).toBe(false)
    expect(next.partners).toMatchObject([
      { hostRef: 'survey-drone', hostSchema: 'equipment', systems: ['s-1'] },
    ])
    expect(PilotSchema.safeParse(next).success).toBe(true)
  })

  test('still drops the vestigial rollResults', () => {
    expect('rollResults' in normalizeLegacyPilotRecord(pilot({ rollResults: [] }))).toBe(false)
  })

  test('returns a current record as-is', () => {
    const current = pilot()
    expect(normalizeLegacyPilotRecord(current)).toBe(current)
  })
})

describe('the strict schema and the stored-body parser', () => {
  test('PilotSchema no longer accepts the key', () => {
    expect(PilotSchema.safeParse(postV11()).success).toBe(false)
  })

  test('StoredPilotSchema accepts a row stored before the removal, and strips it', () => {
    const parsed = StoredPilotSchema.safeParse(postV11())
    expect(parsed.success).toBe(true)
    if (parsed.success) expect('equipmentLoadouts' in parsed.data).toBe(false)
  })
})

async function destroyDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error(`deleteDatabase(${name}) blocked`))
  })
}

/** A raw v15 database — every store exists, so only the v16 rewrite runs. */
async function seedV15Database(name: string, pilots: unknown[]): Promise<void> {
  const { openDB } = await import('idb')
  const db = await openDB(name, 15, {
    upgrade(db) {
      for (const storeName of Object.values(STORE_NAMES)) {
        if (db.objectStoreNames.contains(storeName)) continue
        if (storeName === STORE_NAMES.changeLog) {
          db.createObjectStore(storeName, { keyPath: 'seq', autoIncrement: true })
        } else {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    },
  })
  for (const value of pilots) await db.put(STORE_NAMES.pilots, value)
  db.close()
}

describe('migration ladder: v15 fixture → DB_VERSION (v16)', () => {
  const TEST_DB = 'itun-drop-pilot-equipment-loadouts-test'

  beforeEach(async () => {
    await destroyDatabase(TEST_DB)
  })
  afterEach(async () => {
    await destroyDatabase(TEST_DB)
  })

  test('deletes the key from every stored pilot and leaves the rest alone', async () => {
    const untouched = pilot({ id: 'pilot-2', name: 'Current Pilot' })
    await seedV15Database(TEST_DB, [postV11(), untouched])

    const db = await openItunDatabase(TEST_DB)
    try {
      expect(db.version).toBe(DB_VERSION)
      const healed = await db.get(STORE_NAMES.pilots, 'pilot-1')
      expect('equipmentLoadouts' in healed).toBe(false)
      expect(PilotSchema.parse(healed).partners).toEqual([PARTNER])
      expect(await db.get(STORE_NAMES.pilots, 'pilot-2')).toEqual(untouched)
    } finally {
      db.close()
    }
  })
})

describe('the pilots store heals a row it is handed', () => {
  test('put() caches a Convex row that still carries the key, without salvage', async () => {
    const { pilots } = await import('../index')
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const cached = await pilots.put(postV11() as never)
      expect('equipmentLoadouts' in cached).toBe(false)
      expect(cached.partners).toEqual([PARTNER])
      // Healed by the store's normaliser, not rescued by the salvage path.
      expect(warn).not.toHaveBeenCalled()
      await pilots.delete('pilot-1')
    } finally {
      warn.mockRestore()
    }
  })
})
