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
 * fake-indexeddb/auto and the reference dataset are preloaded via bunfig.toml.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import { useEntityStore } from '../../../stores/entityStore'
import { findNpcChoiceByName, resolveCrawlerBay, resolveCrawlerType } from '../../crawlerRefs'
import {
  _clearAllStores,
  _resetDbSingleton,
  crawlers,
  mechs,
  pilots,
  softLinks,
} from '../../db/index'
import {
  crawlerMaxSP,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../rules/derivedStats'
import { CrawlerSchema } from '../../schemas/crawler'
import { MechSchema } from '../../schemas/mech'
import { PilotSchema } from '../../schemas/pilot'
import { SoftLinkSchema } from '../../schemas/softLink'
import { copyStarterSetToRoster, isStarterSetSeeded } from '../seedStarterSet'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS, STARTER_SOFT_LINKS } from '../starterSet'

/** True when some reference entity of `all` slugifies to `slug`. */
function slugExists(all: ReadonlyArray<{ name: string }>, slug: string): boolean {
  return all.some((e) => nameToSlug(e.name) === slug)
}

describe('Starter Set seed — schema validity', () => {
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

  test('all seeded rows land on the Shelf', () => {
    // Workspaces are retired (ADR-030 §2) — the set no longer has a container
    // of its own, so every row is explicitly shelved rather than undecided.
    for (const e of [...STARTER_PILOTS, ...STARTER_MECHS, ...STARTER_CRAWLERS]) {
      expect(e.gameId).toBeNull()
    }
  })

  test('every pilot, mech, and the crawler carry seeded flavor text', () => {
    for (const p of STARTER_PILOTS) expect(p.description?.length ?? 0).toBeGreaterThan(0)
    for (const m of STARTER_MECHS) expect(m.description?.length ?? 0).toBeGreaterThan(0)
    for (const c of STARTER_CRAWLERS) expect(c.description?.length ?? 0).toBeGreaterThan(0)
  })

  test('ids are unique across the whole seed', () => {
    const ids = [
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

  test('crawler type, every bay ref, and every crawler system resolve', () => {
    for (const c of STARTER_CRAWLERS) {
      if (c.type) expect(resolveCrawlerType(c.type)).not.toBeNull()
      for (const bay of c.crawlerBays ?? []) {
        expect(resolveCrawlerBay(bay.bayRef)).not.toBeNull()
      }
      for (const s of c.systems) expect(resolveSystemRef(s)).toBeTruthy()
    }
  })

  test('every stored Keepsake/Motto choice id matches its NPC in the reference data', () => {
    for (const c of STARTER_CRAWLERS) {
      const bayChoices = c.bayChoices ?? {}

      // Each bay's stored choice ids are exactly that bay NPC's Keepsake + Motto.
      for (const bay of c.crawlerBays ?? []) {
        const stored = Object.keys(bayChoices[bay.bayRef] ?? {})
        if (stored.length === 0) continue
        const npc = resolveCrawlerBay(bay.bayRef)?.npc
        const keepsakeId = findNpcChoiceByName(npc, 'Keepsake')?.id
        const mottoId = findNpcChoiceByName(npc, 'Motto')?.id
        expect(keepsakeId).toBeTruthy()
        expect(mottoId).toBeTruthy()
        if (!keepsakeId || !mottoId) throw new Error('missing Keepsake/Motto choice ids')
        expect([...stored].sort()).toEqual([keepsakeId, mottoId].sort())
      }

      // The crawler-type NPC's stored choice ids are its Keepsake + Motto.
      if (c.type) {
        const stored = Object.keys(bayChoices[c.type] ?? {})
        if (stored.length > 0) {
          const npc = resolveCrawlerType(c.type)?.npc
          const keepsakeId = findNpcChoiceByName(npc, 'Keepsake')?.id
          const mottoId = findNpcChoiceByName(npc, 'Motto')?.id
          expect(keepsakeId).toBeTruthy()
          expect(mottoId).toBeTruthy()
          if (!keepsakeId || !mottoId) throw new Error('missing Keepsake/Motto choice ids')
          expect([...stored].sort()).toEqual([keepsakeId, mottoId].sort())
        }
      }
    }
  })
})

describe('Starter Set seed — derived stats match the canonical chassis', () => {
  // Structure Points / Energy Points / Heat Capacity from the Starter Set Parts
  // Catalogue (the canonical chassis stat blocks), keyed by seeded mech id.
  // Five of the six also match the Reclamation-of-the-Wastes pre-gen sheets; the
  // Bobcat's pre-gen sheet misprints 10/10/6, so we assert its catalogue value.
  const SHEET_MECH_STATS: Record<string, { sp: number; ep: number; heat: number }> = {
    'starter-mech-scrapper': { sp: 9, ep: 9, heat: 8 },
    'starter-mech-spectrum': { sp: 17, ep: 11, heat: 3 },
    'starter-mech-mule': { sp: 12, ep: 4, heat: 6 },
    'starter-mech-bobcat': { sp: 11, ep: 8, heat: 8 },
    'starter-mech-mazona': { sp: 5, ep: 10, heat: 6 },
    'starter-mech-thresher': { sp: 15, ep: 6, heat: 10 },
  }

  test('every mech derives its canonical chassis SP / EP / Heat', () => {
    for (const m of STARTER_MECHS) {
      const expected = SHEET_MECH_STATS[m.id]
      if (!expected) throw new Error(`no sheet stats declared for ${m.id}`)
      const chassis = resolveChassisRef(m.chassisRef)
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

describe('Starter Set seed — on-demand seeding', () => {
  beforeEach(async () => {
    _resetDbSingleton()
    await _clearAllStores()
    useEntityStore.setState({
      pilots: [],
      mechs: [],
      crawlers: [],
      softLinks: [],
      hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
    })
  })

  afterEach(async () => {
    await _clearAllStores()
  })

  test('copyStarterSetToRoster copies the full roster on first call, and it parses', async () => {
    expect(isStarterSetSeeded()).toBe(false)
    await copyStarterSetToRoster()

    const storedPilots = await pilots.list()
    const storedMechs = await mechs.list()
    const storedCrawlers = await crawlers.list()
    expect(storedPilots).toHaveLength(STARTER_PILOTS.length)
    expect(storedMechs).toHaveLength(STARTER_MECHS.length)
    expect(storedCrawlers).toHaveLength(STARTER_CRAWLERS.length)
    expect(await softLinks.list()).toHaveLength(STARTER_SOFT_LINKS.length)

    for (const p of storedPilots) expect(() => PilotSchema.parse(p)).not.toThrow()
    for (const m of storedMechs) expect(() => MechSchema.parse(m)).not.toThrow()
    for (const c of storedCrawlers) expect(() => CrawlerSchema.parse(c)).not.toThrow()
    expect(isStarterSetSeeded()).toBe(true)
  })

  test('is idempotent — a second call never duplicates', async () => {
    await copyStarterSetToRoster()
    await copyStarterSetToRoster()
    expect(await pilots.list()).toHaveLength(STARTER_PILOTS.length)
    expect(await softLinks.list()).toHaveLength(STARTER_SOFT_LINKS.length)
  })

  /**
   * A seeded row is a **copy of a template**, so it gets its own id.
   *
   * This used to write the template's fixed ids straight through, which made
   * every player's starter roster carry the same twelve. Locally that was
   * invisible; against the server of record those ids are the `appId` a row is
   * addressed by — so two players who had both seeded the roster collided on
   * all twelve the moment they claimed, and the later one's writes were refused
   * as edits to somebody else's entity.
   */
  test('seeded rows get fresh UUIDs, not the template ids', async () => {
    await copyStarterSetToRoster()

    const templateIds = new Set([
      ...STARTER_PILOTS.map((r) => r.id),
      ...STARTER_MECHS.map((r) => r.id),
      ...STARTER_CRAWLERS.map((r) => r.id),
    ])
    const stored = [...(await pilots.list()), ...(await mechs.list()), ...(await crawlers.list())]

    expect(stored).toHaveLength(templateIds.size)
    for (const row of stored) {
      expect(templateIds.has(row.id)).toBe(false)
      // Provenance is recorded separately — that is what makes the row
      // recognisable as seeded without borrowing identity to do it.
      expect(templateIds.has(row.seedRef as string)).toBe(true)
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)
    }
  })

  test('two devices seeding the same roster produce disjoint ids', async () => {
    await copyStarterSetToRoster()
    const first = (await pilots.list()).map((p) => p.id).sort()

    // A second browser is a fresh database with the same template.
    await _clearAllStores()
    useEntityStore.setState({
      pilots: [],
      mechs: [],
      crawlers: [],
      softLinks: [],
      hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
    })
    await copyStarterSetToRoster()
    const second = (await pilots.list()).map((p) => p.id).sort()

    expect(second).toHaveLength(first.length)
    // The whole point: no id appears in both rosters.
    expect(first.some((id) => second.includes(id))).toBe(false)
  })

  test('soft links point at the freshly minted ids, not the template ones', async () => {
    await copyStarterSetToRoster()

    const ids = new Set([
      ...(await pilots.list()).map((p) => p.id),
      ...(await mechs.list()).map((m) => m.id),
      ...(await crawlers.list()).map((c) => c.id),
    ])
    const links = await softLinks.list()

    expect(links).toHaveLength(STARTER_SOFT_LINKS.length)
    // A remap that missed an endpoint would leave a link pointing at an id
    // nothing holds — worse than no link at all.
    for (const link of links) {
      expect(ids.has(link.from.id)).toBe(true)
      expect(ids.has(link.to.id)).toBe(true)
    }
  })

  test('a partially deleted roster re-seeds only what is missing', async () => {
    await copyStarterSetToRoster()
    const before = await pilots.list()
    const survivor = before.find((p) => p.seedRef !== before[0]?.seedRef)
    await pilots.delete(before[0]?.id as string)
    // `isStarterSetSeeded` reads the store, and a db-level delete does not
    // reach it — the roster is the evidence, so the evidence has to be current.
    await useEntityStore.getState().rehydrate('pilot')

    expect(isStarterSetSeeded()).toBe(false)
    await copyStarterSetToRoster()

    const after = await pilots.list()
    expect(after).toHaveLength(STARTER_PILOTS.length)
    // The rows that were never deleted keep the ids they already had — a
    // re-seed must not re-mint the roster around them.
    expect(after.some((p) => p.id === survivor?.id)).toBe(true)
  })
})
