/**
 * Starter Set seed guards.
 *
 * The seed rows are written into IndexedDB by an upgrade migration that bypasses
 * crud.ts's Zod parse, and they reference the `salvageunion-reference` dataset
 * by hard-coded slug/id. These tests are the safety net for both:
 *   1. Every row strict-parses its Zod schema (an invalid row fails CI, not a
 *      user's disk).
 *   2. Every reference ref still resolves (a dataset rename fails CI instead of
 *      silently orphaning a seeded mech/pilot/crawler).
 *   3. The v7 upgrade actually lands the whole roster and it re-parses.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml; the reference dataset is
 * preloaded in beforeAll.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'

import {
  crawlerMaxSP,
  findChassisByRef,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../rules/derivedStats'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from '../../rules/resolveRefs'
import { resolveCrawlerBay, resolveCrawlerType } from '../../crawlerRefs'
import { CrawlerSchema } from '../../schemas/crawler'
import { MechSchema } from '../../schemas/mech'
import { PilotSchema } from '../../schemas/pilot'
import { SoftLinkSchema } from '../../schemas/softLink'
import { WorkspaceSchema } from '../../schemas/workspace'
import { DB_VERSION, openItunDatabase } from '../../db/index'
import { STORE_NAMES } from '../../db/stores'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
  STARTER_SOFT_LINKS,
  STARTER_WORKSPACE,
  STARTER_WORKSPACE_ID,
} from '../starterSet'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

/** True when some reference entity of `all` slugifies to `slug`. */
function slugExists(all: ReadonlyArray<{ name: string }>, slug: string): boolean {
  return all.some((e) => nameToSlug(e.name) === slug)
}

describe('Starter Set seed — schema validity', () => {
  test('workspace strict-parses', () => {
    expect(() => WorkspaceSchema.parse(STARTER_WORKSPACE)).not.toThrow()
  })

  test('every pilot strict-parses', () => {
    for (const p of STARTER_PILOTS) expect(() => PilotSchema.parse(p)).not.toThrow()
  })

  test('every mech strict-parses', () => {
    for (const m of STARTER_MECHS) expect(() => MechSchema.parse(m)).not.toThrow()
  })

  test('every crawler strict-parses', () => {
    for (const c of STARTER_CRAWLERS) expect(() => CrawlerSchema.parse(c)).not.toThrow()
  })

  test('every soft link strict-parses', () => {
    for (const l of STARTER_SOFT_LINKS) expect(() => SoftLinkSchema.parse(l)).not.toThrow()
  })

  test('all seeded rows belong to the Starter Set workspace', () => {
    for (const e of [...STARTER_PILOTS, ...STARTER_MECHS, ...STARTER_CRAWLERS]) {
      expect(e.workspaceId).toBe(STARTER_WORKSPACE_ID)
    }
  })

  test('ids are unique across the whole seed', () => {
    const ids = [
      STARTER_WORKSPACE.id,
      ...STARTER_PILOTS.map((p) => p.id),
      ...STARTER_MECHS.map((m) => m.id),
      ...STARTER_CRAWLERS.map((c) => c.id),
      ...STARTER_SOFT_LINKS.map((l) => l.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Starter Set seed — reference refs resolve (drift guard)', () => {
  test('pilot class / ability / equipment refs resolve', () => {
    const classes = SalvageUnionReference.Classes.all()
    const abilities = SalvageUnionReference.Abilities.all()
    const equipment = SalvageUnionReference.Equipment.all()
    for (const p of STARTER_PILOTS) {
      expect(slugExists(classes, p.classRef)).toBe(true)
      for (const a of p.abilities) expect(slugExists(abilities, a)).toBe(true)
      for (const e of p.equipment) expect(slugExists(equipment, e)).toBe(true)
    }
  })

  test('mech chassis / system / module refs resolve', () => {
    for (const m of STARTER_MECHS) {
      expect(resolveChassisRef(m.chassisRef)).toBeTruthy()
      for (const s of m.systems) expect(resolveSystemRef(s)).toBeTruthy()
      for (const mod of m.modules) expect(resolveModuleRef(mod)).toBeTruthy()
    }
  })

  test('crawler type and every bay ref resolve', () => {
    for (const c of STARTER_CRAWLERS) {
      if (c.type) expect(resolveCrawlerType(c.type)).not.toBeNull()
      for (const bay of c.crawlerBays ?? []) {
        expect(resolveCrawlerBay(bay.bayRef)).not.toBeNull()
      }
    }
  })
})

describe('Starter Set seed — derived stats match the Starter Set sheet', () => {
  // Structure Points / Energy Points / Heat Capacity as printed on the
  // *Reclamation of the Wastes* mech sheets, keyed by seeded mech id.
  const SHEET_MECH_STATS: Record<string, { sp: number; ep: number; heat: number }> = {
    'starter-mech-scrapper': { sp: 9, ep: 9, heat: 8 },
    'starter-mech-spectrum': { sp: 17, ep: 11, heat: 3 },
    'starter-mech-mule': { sp: 12, ep: 4, heat: 6 },
    'starter-mech-bobcat': { sp: 10, ep: 10, heat: 6 },
    'starter-mech-mazona': { sp: 5, ep: 10, heat: 6 },
    'starter-mech-thresher': { sp: 15, ep: 6, heat: 10 },
  }

  test('every mech derives the sheet SP / EP / Heat', () => {
    for (const m of STARTER_MECHS) {
      const expected = SHEET_MECH_STATS[m.id]
      if (!expected) throw new Error(`no sheet stats declared for ${m.id}`)
      const chassis = findChassisByRef(m.chassisRef)
      expect(mechMaxSP(m, chassis)).toBe(expected.sp)
      expect(mechMaxEP(m, chassis)).toBe(expected.ep)
      expect(mechMaxHeat(m, chassis)).toBe(expected.heat)
    }
  })

  test('every pilot derives 10 HP / 5 AP', () => {
    for (const p of STARTER_PILOTS) {
      expect(pilotMaxHP(p)).toBe(10)
      expect(pilotMaxAP(p)).toBe(5)
    }
  })

  test('Crawler #430 derives 20 SP (Tech Level 1)', () => {
    for (const c of STARTER_CRAWLERS) {
      expect(crawlerMaxSP(c)).toBe(20)
    }
  })
})

describe('Starter Set seed — soft link integrity', () => {
  const pilotIds = new Set(STARTER_PILOTS.map((p) => p.id))
  const mechIds = new Set(STARTER_MECHS.map((m) => m.id))
  const crawlerIds = new Set(STARTER_CRAWLERS.map((c) => c.id))

  test('one mech-to-pilot and one pilot-to-crawler link per pilot', () => {
    expect(STARTER_SOFT_LINKS).toHaveLength(STARTER_PILOTS.length * 2)
  })

  test('every link endpoint references a seeded entity of the right type', () => {
    for (const l of STARTER_SOFT_LINKS) {
      if (l.type === 'mech-to-pilot') {
        expect(mechIds.has(l.from.id)).toBe(true)
        expect(pilotIds.has(l.to.id)).toBe(true)
      } else {
        expect(pilotIds.has(l.from.id)).toBe(true)
        expect(crawlerIds.has(l.to.id)).toBe(true)
      }
    }
  })
})

describe('Starter Set seed — v7 upgrade lands the roster', () => {
  const TEST_DB_NAME = 'itun-starter-seed-test'

  async function destroyTestDatabase(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(TEST_DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('deleteDatabase blocked — a connection is still open'))
    })
  }

  test('a fresh database opens at DB_VERSION with the full Starter Set seeded and parsing', async () => {
    await destroyTestDatabase()
    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(db.version).toBe(DB_VERSION)

      const workspace = await db.get(STORE_NAMES.workspaces, STARTER_WORKSPACE_ID)
      expect(() => WorkspaceSchema.parse(workspace)).not.toThrow()

      for (const p of STARTER_PILOTS) {
        const stored = await db.get(STORE_NAMES.pilots, p.id)
        expect(() => PilotSchema.parse(stored)).not.toThrow()
      }
      for (const m of STARTER_MECHS) {
        const stored = await db.get(STORE_NAMES.mechs, m.id)
        expect(() => MechSchema.parse(stored)).not.toThrow()
      }
      for (const c of STARTER_CRAWLERS) {
        const stored = await db.get(STORE_NAMES.crawlers, c.id)
        expect(() => CrawlerSchema.parse(stored)).not.toThrow()
      }
      const links = await db.getAll(STORE_NAMES.softLinks)
      expect(links).toHaveLength(STARTER_SOFT_LINKS.length)
    } finally {
      db.close()
      await destroyTestDatabase()
    }
  })
})
