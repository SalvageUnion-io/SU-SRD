/**
 * Tests for the v8 crawler max-SP rewrite (Battle bonus: stored → derived).
 *
 * Pure-rewrite semantics are pinned via `normalizeCrawlerMaxSpRecord`
 * (mirroring mech-refs-to-slugs.test.ts), then the full through-the-opener
 * path is exercised against a seeded v7 fixture database — proving a
 * pre-existing Battle crawler heals to bare-store + read-bonus with NO double
 * +5, and a non-Battle crawler is untouched.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml. Isolation: a dedicated
 * fixture database name, destroyed before/after — the shared app db is never
 * touched here.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { crawlerMaxSP } from 'salvageunion-reference/rules'
import { CrawlerSchema } from '../../schemas/crawler'
import { DB_VERSION, openItunDatabase } from '../index'
import { normalizeCrawlerMaxSpRecord } from '../migrations/8-crawler-battle-sp-to-derived'
import { STORE_NAMES } from '../stores'

const NOW = '2026-01-01T00:00:00.000Z'

/** The Battle type's real SRD id (the migration's frozen snapshot of it). */
const BATTLE_ID = '3d1d9f79-9c56-43fa-a4c9-6dfe10b9aac9'
const ENGINEERING_ID = '4e317382-046b-4a35-bce8-065c6d659a7b'

// ---------------------------------------------------------------------------
// Pure rewrite semantics
// ---------------------------------------------------------------------------

describe('normalizeCrawlerMaxSpRecord (v8 Battle-bonus heal)', () => {
  test('a Battle crawler with the hand-set +5 sheds it (key removed at 0)', () => {
    const next = normalizeCrawlerMaxSpRecord({ type: BATTLE_ID, maxSpModifier: 5 })
    expect(next).not.toBeNull()
    expect('maxSpModifier' in (next as Record<string, unknown>)).toBe(false)
  })

  test('matches the Battle type stored by NAME too (id-or-name refs)', () => {
    const next = normalizeCrawlerMaxSpRecord({ type: 'Battle', maxSpModifier: 5 })
    expect(next).not.toBeNull()
    expect('maxSpModifier' in (next as Record<string, unknown>)).toBe(false)
  })

  test('a hand-edit beyond the bonus survives (7 → 2: previous max preserved)', () => {
    const next = normalizeCrawlerMaxSpRecord({ type: BATTLE_ID, maxSpModifier: 7 })
    expect(next).toMatchObject({ maxSpModifier: 2 })
  })

  test('a STALE Battle crawler (no modifier) is a no-op — it heals at read', () => {
    expect(normalizeCrawlerMaxSpRecord({ type: BATTLE_ID })).toBeNull()
    expect(normalizeCrawlerMaxSpRecord({ type: BATTLE_ID, maxSpModifier: 0 })).toBeNull()
    // A partial modifier below the bonus is treated as stale, not double-set.
    expect(normalizeCrawlerMaxSpRecord({ type: BATTLE_ID, maxSpModifier: 3 })).toBeNull()
  })

  test('non-Battle and untyped crawlers are untouched', () => {
    expect(normalizeCrawlerMaxSpRecord({ type: ENGINEERING_ID, maxSpModifier: 5 })).toBeNull()
    expect(normalizeCrawlerMaxSpRecord({ maxSpModifier: 5 })).toBeNull()
    expect(normalizeCrawlerMaxSpRecord({ type: 'Engineering', maxSpModifier: 5 })).toBeNull()
  })

  test('preserves unrelated fields verbatim on rewrite', () => {
    const next = normalizeCrawlerMaxSpRecord({
      id: 'c-1',
      type: BATTLE_ID,
      maxSpModifier: 5,
      currentSP: 25,
      systems: ['w-1'],
    })
    expect(next).toMatchObject({ id: 'c-1', type: BATTLE_ID, currentSP: 25, systems: ['w-1'] })
  })
})

// ---------------------------------------------------------------------------
// Through the opener: seeded v7 fixture → DB_VERSION
// ---------------------------------------------------------------------------

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
 * Seed a raw fixture database at v7 — every object store already exists at
 * that version (v1 core set, v2 mechPatterns, v5 encounterNpcs), so this
 * fixture isolates the v8 record rewrite from store creation.
 */
async function seedV7Database(name: string, crawlers: unknown[]): Promise<void> {
  const { openDB } = await import('idb')
  const db = await openDB(name, 7, {
    upgrade(db) {
      for (const storeName of Object.values(STORE_NAMES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    },
  })
  for (const value of crawlers) {
    await db.put(STORE_NAMES.crawlers, value)
  }
  db.close()
}

describe('migration ladder: v7 crawler fixture → DB_VERSION (v8 heal)', () => {
  const TEST_DB = 'itun-crawler-battle-sp-test'

  beforeEach(async () => {
    await destroyDatabase(TEST_DB)
  })
  afterEach(async () => {
    await destroyDatabase(TEST_DB)
  })

  const battleHandSet = {
    id: 'crawler-battle-1',
    schemaVersion: 1,
    name: 'War Wagon',
    techLevel: 'tech-1',
    type: BATTLE_ID,
    systems: [],
    maxSpModifier: 5, // the old hand-set convention
    currentSP: 25, // at full under the old derivation (20 + 5)
    createdAt: NOW,
    updatedAt: NOW,
  }

  const battleStale = {
    id: 'crawler-battle-2',
    schemaVersion: 1,
    name: 'Late Bloomer',
    techLevel: 'tech-1',
    type: BATTLE_ID,
    systems: [],
    // No maxSpModifier — the +5 was never applied (stale record).
    currentSP: 20,
    createdAt: NOW,
    updatedAt: NOW,
  }

  const engineering = {
    id: 'crawler-eng-1',
    schemaVersion: 1,
    name: 'Tinker Town',
    techLevel: 'tech-1',
    type: ENGINEERING_ID,
    systems: [],
    maxSpModifier: 5, // a genuine hand-edit on a non-Battle type
    currentSP: 25,
    createdAt: NOW,
    updatedAt: NOW,
  }

  test('Battle heals to bare-store + read-bonus (no double +5); non-Battle untouched', async () => {
    await seedV7Database(TEST_DB, [battleHandSet, battleStale, engineering])

    const db = await openItunDatabase(TEST_DB)
    try {
      expect(db.version).toBe(DB_VERSION)

      // Hand-set Battle: modifier shed; derived max is EXACTLY the previous
      // 25 (base 20 + read-bonus 5) — not 30 (the double-count failure mode).
      const healed = CrawlerSchema.parse(await db.get(STORE_NAMES.crawlers, 'crawler-battle-1'))
      expect(healed.maxSpModifier).toBeUndefined()
      expect(crawlerMaxSP(healed)).toBe(25)
      expect(healed.currentSP).toBe(25) // still at full — no clamp needed

      // Stale Battle: record untouched; the read path now grants the +5.
      const stale = CrawlerSchema.parse(await db.get(STORE_NAMES.crawlers, 'crawler-battle-2'))
      expect(stale.maxSpModifier).toBeUndefined()
      expect(crawlerMaxSP(stale)).toBe(25)

      // Non-Battle: hand-edit preserved verbatim; no type bonus at read.
      const eng = CrawlerSchema.parse(await db.get(STORE_NAMES.crawlers, 'crawler-eng-1'))
      expect(eng.maxSpModifier).toBe(5)
      expect(crawlerMaxSP(eng)).toBe(25)
    } finally {
      db.close()
    }
  })
})
