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
 *      (mechs, crawlers, workspaces, softLinks, mechPatterns, encounterNpcs)
 *      and asserts every OTHER known field — including nested arrays/objects
 *      — round-trips exactly. A field silently vanishing that ISN'T the
 *      injected unknown one would be drift beyond the documented contract.
 *
 *   2. Surfaces a boundary ADR-002 does not spell out: `schema.strip()` only
 *      relaxes unknown-key checking at the TOP level. Every nested `.strict()`
 *      sub-schema (CargoLotSchema, InjurySchema, EntityRefSchema,
 *      CrawlerNpcStateSchema, MediatorRollResultSchema, ...) stays strict, so
 *      an unknown key introduced by a NEWER build inside a nested object
 *      fails BOTH the strict parse and the salvage parse — the salvage path
 *      cannot rescue it, and the whole record is skipped (silently, with only
 *      a console.warn) rather than the offending nested field alone.
 *
 *      This is a genuine gap relative to the "nothing beyond the unknown
 *      field is dropped" expectation: an entire pilot/mech/crawler/etc. can
 *      vanish from list()/get() until a NEWER build writes to it again. There
 *      is no migration or code change proposed here for this — see the
 *      finding note in the PR description; it is flagged as a TODO for a
 *      follow-up (e.g. teaching `salvageRead` to fall back further, or
 *      loosening nested schemas to `.strip()` too) rather than guessed at.
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
  workspaces,
} from '../index'
import { STORE_NAMES } from '../stores'

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
      expect('fieldFromTheFuture' in (record as unknown as Record<string, unknown>)).toBe(false)
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
      expect('fieldFromTheFuture' in (record as unknown as Record<string, unknown>)).toBe(false)
      expect(record).toEqual(created)
      expect(warnings.some((w) => w.includes('salvage path'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('workspace — survives with all fields intact', async () => {
    const created = await workspaces.create({ schemaVersion: 1, name: 'Campaign Alpha' })

    await putRaw(STORE_NAMES.workspaces, { ...created, fieldFromTheFuture: 'x' })

    const { warnings, restore } = captureWarnings()
    try {
      const record = await workspaces.get(created.id)
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
// 2. FINDING: an unknown key nested inside a `.strict()` sub-schema is NOT
//    rescued by the top-level salvage `.strip()` — the whole record is
//    skipped (silently dropped from list()/get(), with only a console.warn).
// ---------------------------------------------------------------------------

describe('salvage read: unknown key in a NESTED strict sub-schema drops the whole record', () => {
  test('mech — unknown key inside cargoLots[0] makes the record unreadable', async () => {
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
      // get(): the record cannot even be salvaged — it reads as null, not a
      // partially-healed record. This is the gap: the whole mech (name,
      // systems, conditions, everything) is invisible, not just the drifted
      // cargo lot.
      const record = await mechs.get(created.id)
      expect(record).toBeNull()
      // list() likewise omits it rather than surfacing a partial record.
      const all = await mechs.list()
      expect(all.some((m) => m.id === created.id)).toBe(false)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('pilot — unknown key inside injuries[0] makes the record unreadable', async () => {
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
      expect(record).toBeNull()
      const all = await pilots.list()
      expect(all.some((p) => p.id === created.id)).toBe(false)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(true)
    } finally {
      restore()
    }
  })

  test('softLink — unknown key inside the `from` ref makes the record unreadable', async () => {
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
      expect(record).toBeNull()
      const all = await softLinks.list()
      expect(all.some((l) => l.id === created.id)).toBe(false)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(true)
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
      expect((raw as Record<string, unknown>)['name']).toBe('Healed Mech')
    } finally {
      db.close()
    }
  })
})
