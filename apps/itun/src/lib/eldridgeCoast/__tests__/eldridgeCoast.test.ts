/**
 * The Eldridge Coast seed guards — the built-in home-campaign workspace.
 *
 * Mirrors the Starter Set seed test (../../starterSet/__tests__): the static
 * rows reference the `salvageunion-reference` dataset by hard-coded slug/id and
 * are written into IndexedDB by the on-demand seeder, so these tests are the
 * safety net for both:
 *   1. Every row strict-parses its Zod schema.
 *   2. Every reference ref still resolves (a dataset rename fails CI instead of
 *      silently orphaning a seeded row) — EXCEPT the four intentionally
 *      home-brew drone/companion "chassis", which are asserted to stay
 *      unresolved (documented fidelity gap).
 *   3. The on-demand seeder lands the whole roster and it re-parses.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml; the reference dataset is
 * preloaded in beforeAll.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'

import { crawlerMaxSP, pilotMaxAP, pilotMaxHP } from '../../rules/derivedStats'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import { resolveCrawlerBay, resolveCrawlerType } from '../../crawlerRefs'
import { CrawlerSchema } from '../../schemas/crawler'
import { MechSchema } from '../../schemas/mech'
import { PilotSchema } from '../../schemas/pilot'
import { SoftLinkSchema } from '../../schemas/softLink'
import { WorkspaceSchema } from '../../schemas/workspace'
import {
  _clearAllStores,
  _resetDbSingleton,
  crawlers,
  mechs,
  pilots,
  softLinks,
  workspaces,
} from '../../db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { ensureEldridgeCoastSeeded, isEldridgeCoastSeeded } from '../seedEldridgeCoast'
import {
  ELDRIDGE_CRAWLERS,
  ELDRIDGE_MECHS,
  ELDRIDGE_PILOTS,
  ELDRIDGE_SOFT_LINKS,
  ELDRIDGE_WORKSPACE,
  ELDRIDGE_WORKSPACE_ID,
} from '../eldridgeCoast'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

/** True when some reference entity of `all` slugifies to `slug`. */
function slugExists(all: ReadonlyArray<{ name: string }>, slug: string): boolean {
  return all.some((e) => nameToSlug(e.name) === slug)
}

describe('Eldridge Coast seed — schema validity', () => {
  test('workspace strict-parses', () => {
    expect(() => WorkspaceSchema.parse(ELDRIDGE_WORKSPACE)).not.toThrow()
  })

  test('every pilot strict-parses', () => {
    for (const p of ELDRIDGE_PILOTS) expect(() => PilotSchema.parse(p)).not.toThrow()
  })

  test('every mech strict-parses', () => {
    for (const m of ELDRIDGE_MECHS) expect(() => MechSchema.parse(m)).not.toThrow()
  })

  test('every crawler strict-parses', () => {
    for (const c of ELDRIDGE_CRAWLERS) expect(() => CrawlerSchema.parse(c)).not.toThrow()
  })

  test('every soft link strict-parses', () => {
    for (const l of ELDRIDGE_SOFT_LINKS) expect(() => SoftLinkSchema.parse(l)).not.toThrow()
  })

  test('all seeded rows belong to the Eldridge Coast workspace', () => {
    for (const e of [...ELDRIDGE_PILOTS, ...ELDRIDGE_MECHS, ...ELDRIDGE_CRAWLERS]) {
      expect(e.workspaceId).toBe(ELDRIDGE_WORKSPACE_ID)
    }
  })

  test('every entity carries seeded flavor text in fields the sheet renders', () => {
    // Pilots render `description` (Bio) + `background`; mechs render `quirk` +
    // `appearance` (NOT `description`, which is deprecated/suppressed); crawlers
    // render `description`.
    for (const p of ELDRIDGE_PILOTS) expect(p.description?.length ?? 0).toBeGreaterThan(0)
    for (const m of ELDRIDGE_MECHS) {
      expect(m.quirk?.length ?? 0).toBeGreaterThan(0)
      expect(m.appearance?.length ?? 0).toBeGreaterThan(0)
    }
    for (const c of ELDRIDGE_CRAWLERS) expect(c.description?.length ?? 0).toBeGreaterThan(0)
  })

  test('mechs do not write the deprecated (unrendered) description field', () => {
    for (const m of ELDRIDGE_MECHS) expect(m.description).toBeUndefined()
  })

  test('ids are unique across the whole seed', () => {
    const ids = [
      ELDRIDGE_WORKSPACE.id,
      ...ELDRIDGE_PILOTS.map((p) => p.id),
      ...ELDRIDGE_MECHS.map((m) => m.id),
      ...ELDRIDGE_CRAWLERS.map((c) => c.id),
      ...ELDRIDGE_SOFT_LINKS.map((l) => l.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Eldridge Coast seed — reference refs resolve (drift guard)', () => {
  test('pilot class / ability / equipment refs resolve', () => {
    const classes = SalvageUnionReference.Classes.all()
    const abilities = SalvageUnionReference.Abilities.all()
    const equipment = SalvageUnionReference.Equipment.all()
    for (const p of ELDRIDGE_PILOTS) {
      expect(slugExists(classes, p.classRef)).toBe(true)
      for (const a of p.abilities) expect(slugExists(abilities, a)).toBe(true)
      for (const e of p.equipment) expect(slugExists(equipment, e)).toBe(true)
    }
  })

  test('every mech system / module ref resolves', () => {
    for (const m of ELDRIDGE_MECHS) {
      for (const s of m.systems) expect(resolveSystemRef(s)).toBeTruthy()
      for (const mod of m.modules) expect(resolveModuleRef(mod)).toBeTruthy()
    }
  })

  test('every mech chassis resolves (all six use standard SRD chassis)', () => {
    for (const m of ELDRIDGE_MECHS) {
      expect(resolveChassisRef(m.chassisRef)).toBeTruthy()
    }
  })

  test('every partner system/module ref resolves', () => {
    // This guard used to read `equipmentLoadouts`. When the companions moved to
    // `partners` (ADR-027) that field went undefined on every seeded pilot, so
    // the loops stopped executing and the test passed having asserted nothing —
    // a drift guard that silently stopped guarding. The count assertion below
    // is the fix: it fails if the refs it walks ever go empty again.
    let checked = 0
    for (const p of ELDRIDGE_PILOTS) {
      for (const partner of p.partners ?? []) {
        for (const s of partner.systems) {
          expect(resolveSystemRef(s)).toBeTruthy()
          checked++
        }
        for (const mod of partner.modules) {
          expect(resolveModuleRef(mod)).toBeTruthy()
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('the three companion owners carry the granted drone equipment', () => {
    const byId = new Map(ELDRIDGE_PILOTS.map((p) => [p.id, p]))
    const cali = byId.get('eldridge-pilot-caligula')
    const gersin = byId.get('eldridge-pilot-gersin')
    const roach = byId.get('eldridge-pilot-roach-boy')
    expect(cali?.equipment).toContain('survey-drone')
    expect(cali?.equipment).toContain('mecha-companion')
    expect(gersin?.equipment).toContain('survey-drone')
    expect(roach?.equipment).toContain('auto-turret')
    // Each drone-equipment slug has a matching PARTNER instance (ADR-027).
    // The equipment entry is the GRANT; the partner is the thing granted, and
    // it is what carries the loadout, the name and the stats.
    for (const p of [cali, gersin, roach]) {
      for (const slug of ['survey-drone', 'mecha-companion', 'auto-turret']) {
        if (p?.equipment.includes(slug)) {
          expect(p.partners?.some((partner) => partner.hostRef === slug)).toBe(true)
        }
      }
    }
  })

  test('companions are named partner instances with their own ids', () => {
    const byId = new Map(ELDRIDGE_PILOTS.map((p) => [p.id, p]))
    const names = ELDRIDGE_PILOTS.flatMap((p) => (p.partners ?? []).map((x) => x.name))
    expect(names).toEqual(expect.arrayContaining(['Custos', 'Incitatus', 'PR-1', 'Rek Jet']))

    // Caligula fields TWO — the case slug-keyed loadouts could not express.
    const cali = byId.get('eldridge-pilot-caligula')
    expect(cali?.partners).toHaveLength(2)
    expect(new Set(cali?.partners?.map((x) => x.id)).size).toBe(2)

    // Every partner id is unique across the whole seed: they are addressed by a
    // flat /sheet/partner/:id, so a collision would open the wrong sheet.
    const ids = ELDRIDGE_PILOTS.flatMap((p) => (p.partners ?? []).map((x) => x.id))
    expect(new Set(ids).size).toBe(ids.length)

    // hostSchema is 'equipment' for every pilot-granted partner — the
    // disambiguator that keeps 'survey-drone' off the opposition stat block.
    for (const p of ELDRIDGE_PILOTS) {
      for (const partner of p.partners ?? []) {
        expect(partner.hostSchema).toBe('equipment')
      }
    }
  })

  test('crawler mounted weapons resolve via the crawler sheet id/name path', () => {
    // The crawler sheet's resolveCrawlerSystem matches by `id` OR `name` only
    // (NOT slug), so a slug-stored weapon would render as a raw chit. Guard the
    // exact matching the UI uses.
    const systems = SalvageUnionReference.Systems.all() as ReadonlyArray<{
      id: string
      name: string
    }>
    for (const c of ELDRIDGE_CRAWLERS) {
      for (const s of c.systems) {
        expect(systems.some((sys) => sys.id === s || sys.name === s)).toBe(true)
      }
    }
  })

  test('crawler type, every bay ref, and every crawler system resolve', () => {
    for (const c of ELDRIDGE_CRAWLERS) {
      if (c.type) expect(resolveCrawlerType(c.type)).not.toBeNull()
      for (const bay of c.crawlerBays ?? []) {
        expect(resolveCrawlerBay(bay.bayRef)).not.toBeNull()
      }
      for (const s of c.systems) expect(resolveSystemRef(s)).toBeTruthy()
    }
  })
})

describe('Eldridge Coast seed — derived stats', () => {
  test('each pilot derives 10 + maxHpModifier HP and 5 + maxApModifier AP', () => {
    for (const p of ELDRIDGE_PILOTS) {
      expect(pilotMaxHP(p)).toBe(10 + (p.maxHpModifier ?? 0))
      expect(pilotMaxAP(p)).toBe(5 + (p.maxApModifier ?? 0))
    }
  })

  test('both crawlers derive 35 SP (Tech Level 4 / City)', () => {
    for (const c of ELDRIDGE_CRAWLERS) expect(crawlerMaxSP(c)).toBe(35)
  })
})

describe('Eldridge Coast seed — soft link integrity', () => {
  const pilotIds = new Set(ELDRIDGE_PILOTS.map((p) => p.id))
  const mechIds = new Set(ELDRIDGE_MECHS.map((m) => m.id))
  const crawlerIds = new Set(ELDRIDGE_CRAWLERS.map((c) => c.id))

  test('every pilot crews a crawler and every mech links to its owning pilot', () => {
    // 6 pilot-to-crawler + 10 mech-to-pilot (each mech assigned to a pilot).
    expect(ELDRIDGE_SOFT_LINKS).toHaveLength(ELDRIDGE_PILOTS.length + ELDRIDGE_MECHS.length)
  })

  test('every mech has exactly one mech-to-pilot link', () => {
    const linkedMechIds = ELDRIDGE_SOFT_LINKS.filter((l) => l.type === 'mech-to-pilot').map(
      (l) => l.from.id
    )
    expect([...linkedMechIds].sort()).toEqual([...mechIds].sort())
  })

  test('every link endpoint references a seeded entity of the right type', () => {
    for (const l of ELDRIDGE_SOFT_LINKS) {
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

describe('Eldridge Coast seed — on-demand seeding', () => {
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
    useWorkspaceStore.setState({ workspaces: [], hydrated: false })
  })

  afterEach(async () => {
    await _clearAllStores()
  })

  test('ensureEldridgeCoastSeeded spawns the full roster on first call, and it parses', async () => {
    expect(isEldridgeCoastSeeded()).toBe(false)
    await ensureEldridgeCoastSeeded()

    expect((await workspaces.list()).some((w) => w.id === ELDRIDGE_WORKSPACE_ID)).toBe(true)

    const storedPilots = await pilots.list()
    const storedMechs = await mechs.list()
    const storedCrawlers = await crawlers.list()
    expect(storedPilots).toHaveLength(ELDRIDGE_PILOTS.length)
    expect(storedMechs).toHaveLength(ELDRIDGE_MECHS.length)
    expect(storedCrawlers).toHaveLength(ELDRIDGE_CRAWLERS.length)
    expect(await softLinks.list()).toHaveLength(ELDRIDGE_SOFT_LINKS.length)

    for (const p of storedPilots) expect(() => PilotSchema.parse(p)).not.toThrow()
    for (const m of storedMechs) expect(() => MechSchema.parse(m)).not.toThrow()
    for (const c of storedCrawlers) expect(() => CrawlerSchema.parse(c)).not.toThrow()
    expect(isEldridgeCoastSeeded()).toBe(true)
  })

  test('is idempotent — a second call never duplicates', async () => {
    await ensureEldridgeCoastSeeded()
    await ensureEldridgeCoastSeeded()
    expect(await workspaces.list()).toHaveLength(1)
    expect(await pilots.list()).toHaveLength(ELDRIDGE_PILOTS.length)
    expect(await softLinks.list()).toHaveLength(ELDRIDGE_SOFT_LINKS.length)
  })
})
