/**
 * Version-skew simulation harness (durability audit, item 2).
 *
 * ADR-002 documents the salvage-read contract: "a strict parse is attempted
 * first; on failure the row is re-parsed with a lenient salvage schema
 * (`.strip()`) and a warning is logged... Salvage-on-read can silently strip
 * data a tab is too old to understand."
 *
 * migrations.test.ts already proves this for ONE case: a pilot record with a
 * stray TOP-LEVEL unknown field. This file:
 *
 *   1. Extends the "top-level unknown field survives" case to every store
 *      (mechs, crawlers, softLinks, mechPatterns, encounterNpcs)
 *      and asserts every OTHER known field — including nested arrays/objects
 *      — round-trips exactly. A field silently vanishing that ISN'T the
 *      injected unknown one would be drift beyond the documented contract.
 *
 *   2. Covers a boundary ADR-002 does not spell out: a plain `schema.strip()`
 *      only relaxes unknown-key checking at the TOP level. Every nested
 *      `.strict()` sub-schema (CargoLotSchema, InjurySchema, EntityRefSchema,
 *      CrawlerNpcStateSchema, MediatorRollResultSchema, ...) would otherwise
 *      stay strict, so an unknown key introduced by a NEWER build inside a
 *      nested object would fail BOTH the strict parse and a shallow salvage
 *      parse — dropping the whole record instead of just the offending
 *      nested field.
 *
 *      Fixed by `deepStrip()` (src/lib/schemas/deepStrip.ts): the salvage
 *      schemas wired in db/index.ts now recursively relax every `.strict()`
 *      object at every nesting depth, not just the outermost one. The tests
 *      below assert the FIXED behavior — a nested unknown key is stripped
 *      and the record survives with every other field intact, exactly like
 *      the top-level case in section 1.
 *
 * Isolation: uses the SHARED app db (no version games, no deletes beyond
 * `_clearAllStores()`), matching migrations.test.ts's "salvage read path"
 * section. Every raw connection opened here is closed before the test ends.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  _clearAllStores,
  crawlers,
  encounterNpcs,
  mechPatterns,
  mechs,
  openItunDatabase,
  pilots,
  softLinks,
} from '../index'
import { STORE_NAMES } from '../stores'
import { must } from '../../../components/__tests__/must'

/** Overwrite a record's raw bytes in IDB, bypassing all Zod validation. */
async function putRaw(storeName: string, record: unknown): Promise<void> {
  const db = await openItunDatabase()
  try {
    await db.put(storeName, record)
  } finally {
    db.close()
  }
}

function captureWarnings(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }
  return { warnings, restore: () => (console.warn = original) }
}

beforeEach(async () => {
  await _clearAllStores()
})

afterEach(async () => {
  await _clearAllStores()
})

// ---------------------------------------------------------------------------
// 1. Top-level unknown field: stripped, record survives, EVERY other known
//    field (including nested structures) is preserved exactly.
// ---------------------------------------------------------------------------

describe('salvage read: top-level unknown field strips only that field', () => {
  test('mech — nested cargoLots/conditions/maps all survive intact', async () => {
    const created = await mechs.create({
      schemaVersion: 1,
      name: 'Test Mech',
      chassisRef: 'iron-mongrel',
      systems: ['welding-rig'],
      modules: ['armor-plating'],
      cargoLots: [
        { id: 'lot-1', kind: 'unit', name: 'Medkit', cat: 'SEALED', units: 1, code: 'MED' },
      ],
      conditions: ['prone'],
      currentSP: 5,
      systemConditions: { 'welding-rig': 'damaged' },
    })

    await putRaw(STORE_NAMES.mechs, { ...created, fieldFromTheFuture: 'whatever' })

    const { warnings, restore } = captureWarnings()
    try {
      const record = await mechs.get(created.id)
      expect(record).not.toBeNull()
      expect('fieldFromTheFuture' in must(record)).toBe(false)
      // Every other field survives — this is the "nothing else is dropped" check.
      expect(record).toEqual(created)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('crawler — nested crawlerBays/scrapPool survive intact', async () => {
    const created = await crawlers.create({
      schemaVersion: 1,
      name: 'Test Crawler',
      techLevel: 'tech-2',
      systems: ['scanner-array'],
      crawlerBays: [{ bayRef: 'command-bay', npcName: 'Lira', npcCurrentHP: 4 }],
      scrapPool: { tl1: 3, tl2: 1 },
    })

    await putRaw(STORE_NAMES.crawlers, { ...created, fieldFromTheFuture: true })

    const { warnings, restore } = captureWarnings()
    try {
      const record = await crawlers.get(created.id)
      expect(record).not.toBeNull()
      expect('fieldFromTheFuture' in must(record)).toBe(false)
      expect(record).toEqual(created)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('softLink — from/to endpoints survive intact', async () => {
    const created = await softLinks.create({
      from: { type: 'mech', id: 'mech-1' },
      to: { type: 'pilot', id: 'pilot-1' },
      type: 'mech-to-pilot',
    })

    await putRaw(STORE_NAMES.softLinks, { ...created, fieldFromTheFuture: 1 })

    const { warnings, restore } = captureWarnings()
    try {
      const record = await softLinks.get(created.id)
      expect(record).toEqual(created)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('mechPattern — nested cargoLots survives intact', async () => {
    const created = await mechPatterns.create({
      schemaVersion: 1,
      name: 'Scout Loadout',
      chassisRef: 'mule-chassis',
      systems: ['sensor-suite'],
      modules: [],
      cargoLots: [
        { id: 'lot-1', kind: 'unit', name: 'Medkit', cat: 'SEALED', units: 1, code: 'MED' },
      ],
    })

    await putRaw(STORE_NAMES.mechPatterns, { ...created, fieldFromTheFuture: [] })

    const { warnings, restore } = captureWarnings()
    try {
      const record = await mechPatterns.get(created.id)
      expect(record).toEqual(created)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('encounterNpc — all fields survive intact', async () => {
    const created = await encounterNpcs.create({
      schemaVersion: 1,
      refSchema: 'npcs',
      refSlug: 'raider',
      refName: 'Raider',
      name: 'Raider 2',
      currentHp: 3,
      maxHp: 3,
      statKind: 'hp',
      conditions: ['prone'],
    })

    await putRaw(STORE_NAMES.encounterNpcs, { ...created, fieldFromTheFuture: null })

    const { warnings, restore } = captureWarnings()
    try {
      const record = await encounterNpcs.get(created.id)
      expect(record).toEqual(created)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// 2. FIXED: an unknown key nested inside a `.strict()` sub-schema is now
//    rescued by deepStrip() — only the drifted nested field is dropped; the
//    record survives with every other field (including its siblings in the
//    same nested object/array) intact, matching the top-level contract in
//    section 1.
// ---------------------------------------------------------------------------

describe('salvage read: unknown key in a NESTED strict sub-schema drops only that field', () => {
  test('mech — unknown key inside cargoLots[0] strips just that key; the mech survives', async () => {
    const created = await mechs.create({
      schemaVersion: 1,
      name: 'Test Mech',
      chassisRef: 'iron-mongrel',
      systems: [],
      modules: [],
      cargoLots: [
        { id: 'lot-1', kind: 'unit', name: 'Medkit', cat: 'SEALED', units: 1, code: 'MED' },
      ],
      conditions: [],
    })

    const drifted = {
      ...created,
      cargoLots: [{ ...created.cargoLots[0], fieldFromTheFuture: 'x' }],
    }
    await putRaw(STORE_NAMES.mechs, drifted)

    const { warnings, restore } = captureWarnings()
    try {
      // get(): the mech is salvaged, not dropped — the drifted key inside
      // cargoLots[0] is stripped and every other field (name, systems,
      // conditions, the rest of the cargo lot) round-trips exactly.
      const record = await mechs.get(created.id)
      expect(record).not.toBeNull()
      expect('fieldFromTheFuture' in (must(record).cargoLots[0] ?? {})).toBe(false)
      expect(record).toEqual(created)
      // list() surfaces it too, not just get().
      const all = await mechs.list()
      expect(all.some((m) => m.id === created.id)).toBe(true)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('pilot — unknown key inside injuries[0] strips just that key; the pilot survives', async () => {
    const created = await pilots.create({
      schemaVersion: 1,
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
      injuries: [{ severity: 'minor', note: 'Twisted ankle.' }],
    })

    const drifted = {
      ...created,
      injuries: [{ ...created.injuries?.[0], newSeverityMeta: 'x' }],
    }
    await putRaw(STORE_NAMES.pilots, drifted)

    const { warnings, restore } = captureWarnings()
    try {
      const record = await pilots.get(created.id)
      expect(record).not.toBeNull()
      expect('newSeverityMeta' in (must(record).injuries?.[0] ?? {})).toBe(false)
      expect(record).toEqual(created)
      const all = await pilots.list()
      expect(all.some((p) => p.id === created.id)).toBe(true)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('softLink — unknown key inside the `from` ref strips just that key; the link survives', async () => {
    const created = await softLinks.create({
      from: { type: 'mech', id: 'mech-1' },
      to: { type: 'pilot', id: 'pilot-1' },
      type: 'mech-to-pilot',
    })

    const drifted = { ...created, from: { ...created.from, endpointVersion: 2 } }
    await putRaw(STORE_NAMES.softLinks, drifted)

    const { warnings, restore } = captureWarnings()
    try {
      const record = await softLinks.get(created.id)
      expect(record).not.toBeNull()
      expect('endpointVersion' in must(record).from).toBe(false)
      expect(record).toEqual(created)
      const all = await softLinks.list()
      expect(all.some((l) => l.id === created.id)).toBe(true)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(false)
    } finally {
      restore()
    }
  })

  test('crawler — unknown key inside crawlerBays[0] (an .extend()-ed strict sub-schema) strips just that key; the crawler survives', async () => {
    const created = await crawlers.create({
      schemaVersion: 1,
      name: 'Test Crawler',
      techLevel: 'tech-2',
      systems: [],
      crawlerBays: [{ bayRef: 'command-bay', npcName: 'Lira', npcCurrentHP: 4 }],
    })

    const drifted = {
      ...created,
      crawlerBays: [{ ...created.crawlerBays?.[0], npcMorale: 'high' }],
    }
    await putRaw(STORE_NAMES.crawlers, drifted)

    const { warnings, restore } = captureWarnings()
    try {
      const record = await crawlers.get(created.id)
      expect(record).not.toBeNull()
      expect('npcMorale' in (must(record).crawlerBays?.[0] ?? {})).toBe(false)
      expect(record).toEqual(created)
      const all = await crawlers.list()
      expect(all.some((c) => c.id === created.id)).toBe(true)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(false)
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Heal-on-write: a top-level-drifted record heals back to strict shape on
//    its next write (already proven for pilots in migrations.test.ts) —
//    extended here to a second store to confirm it's the general contract,
//    not a pilot-only behaviour.
// ---------------------------------------------------------------------------

describe('salvage read: heal on next write', () => {
  test('a top-level-drifted mech heals to strict shape on its next update', async () => {
    const created = await mechs.create({
      schemaVersion: 1,
      name: 'Test Mech',
      chassisRef: 'iron-mongrel',
      systems: [],
      modules: [],
      cargoLots: [],
      conditions: [],
    })
    await putRaw(STORE_NAMES.mechs, { ...created, fieldFromTheFuture: true })

    const { restore } = captureWarnings()
    try {
      await mechs.update(created.id, { name: 'Healed Mech' })
    } finally {
      restore()
    }

    const db = await openItunDatabase()
    try {
      const raw = await db.get(STORE_NAMES.mechs, created.id)
      expect('fieldFromTheFuture' in (raw as Record<string, unknown>)).toBe(false)
      expect((raw as Record<string, unknown>).name).toBe('Healed Mech')
    } finally {
      db.close()
    }
  })
})
