/**
 * `legacyRows.rewrite` — the one-off that leaves every stored row canonical
 * (#1179). One row per rule, run as the owner runs it: a dry run, an apply,
 * and a second apply that must find nothing left to do.
 */

import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { internal } from '../../convex/_generated/api'
import { canonicalRow } from '../../convex/legacyRows'
import type { Ctx } from './fixtures'
import { crawlerBody, makeUser, mechBody, pilotBody } from './fixtures'
import { testConvex } from './harness'

/** The first row of a loaded schema: any one entity serves as a stored ref. */
function first<T>(rows: T[]): T {
  const row = rows[0]
  if (row === undefined) throw new Error('reference data is not loaded')
  return row
}

const ability = first(SalvageUnionReference.Abilities.all())
const item = first(SalvageUnionReference.Equipment.all())
const drone = first(SalvageUnionReference.Drones.all())
const chassis = first(SalvageUnionReference.Chassis.all())
const system = first(SalvageUnionReference.Systems.all())
const mechModule = first(SalvageUnionReference.Modules.all())
const crawlerType = first(SalvageUnionReference.Crawlers.all())
const bay = first(SalvageUnionReference.CrawlerBays.all())

/** Every legacy shape the rewrite knows, one row each, plus the rows it must leave alone. */
async function seed(t: Ctx) {
  const me = await makeUser(t, 'Me')
  return await t.run(async (ctx) => {
    const gameId = await ctx.db.insert('games', { name: 'Tenacity' })
    const pilot = await ctx.db.insert('pilots', {
      gameId: null,
      ownerId: me.userId,
      appId: 'p1',
      updatedAt: 1,
      body: pilotBody({
        workspaceId: 'default-workspace',
        abilities: [ability.id],
        usedAbilities: [ability.id],
        equipment: [item.id],
        equipmentConditions: { [item.id]: 'damaged' },
        partners: [
          {
            id: 'partner-1',
            hostRef: item.id,
            hostSchema: 'equipment',
            systems: [system.id],
            modules: [mechModule.id],
            systemConditions: { [system.id]: 'damaged' },
            itemUses: { [mechModule.id]: 1 },
          },
        ],
      }),
    })
    // The rewrite would strip `workspaceId`, but the name is empty, so the
    // result fails the schema and the row must not be written.
    const unparseable = await ctx.db.insert('pilots', {
      gameId: null,
      ownerId: me.userId,
      appId: 'p2',
      updatedAt: 1,
      body: pilotBody({ id: 'p2', name: '', workspaceId: 'default-workspace' }),
    })
    const mech = await ctx.db.insert('mechs', {
      gameId: null,
      ownerId: me.userId,
      appId: 'm1',
      updatedAt: 1,
      body: mechBody({
        gameId: null,
        description: 'Rust-red',
        chassisRef: chassis.name,
        systems: [system.id],
        systemConditions: { [system.id]: 'damaged' },
        partners: [
          {
            id: 'partner-2',
            hostRef: drone.name,
            hostSchema: 'drones',
            modules: [mechModule.name],
            moduleConditions: { [mechModule.name]: 'destroyed' },
          },
        ],
      }),
    })
    const unresolved = await ctx.db.insert('mechs', {
      gameId: null,
      ownerId: me.userId,
      appId: 'm2',
      updatedAt: 1,
      body: mechBody({ id: 'm2', gameId: null, systems: ['no-such-system'] }),
    })
    const crawler = await ctx.db.insert('crawlers', {
      gameId,
      appId: 'c1',
      updatedAt: 1,
      body: crawlerBody({
        gameId,
        workspaceId: gameId,
        type: crawlerType.id,
        crawlerBays: [{ bayRef: bay.id, npcName: 'Doc' }],
        systems: [system.id],
        bayChoices: { [bay.id]: { Keepsake: ['a coin'] }, [crawlerType.id]: { Motto: ['onward'] } },
      }),
    })
    const pattern = await ctx.db.insert('mechPatterns', {
      ownerId: me.userId,
      gameId: null,
      appId: 'pat1',
      body: {
        id: 'pat1',
        schemaVersion: 1,
        name: 'Brawler',
        chassisRef: getEntitySlug(chassis),
        systems: [],
        modules: [mechModule.id],
        cargoLots: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    })
    const kept = await ctx.db.insert('softLinks', {
      gameId: null,
      from: { type: 'mech', id: 'm1' },
      to: { type: 'pilot', id: 'p1' },
      type: 'mech-to-pilot',
    })
    const orphan = await ctx.db.insert('softLinks', {
      gameId: null,
      from: { type: 'pilot', id: 'p1' },
      to: { type: 'crawler', id: 'gone' },
      type: 'pilot-to-crawler',
    })
    return { pilot, unparseable, mech, unresolved, crawler, pattern, kept, orphan }
  })
}

async function snapshot(t: Ctx) {
  return await t.run(async (ctx) => ({
    pilots: await ctx.db.query('pilots').collect(),
    mechs: await ctx.db.query('mechs').collect(),
    crawlers: await ctx.db.query('crawlers').collect(),
    mechPatterns: await ctx.db.query('mechPatterns').collect(),
    softLinks: await ctx.db.query('softLinks').collect(),
  }))
}

describe('legacyRows.rewrite', () => {
  test('a dry run reports every rule and writes nothing', async () => {
    const t = testConvex()
    const ids = await seed(t)
    const before = await snapshot(t)

    const report = await t.action(internal.legacyRows.rewrite, { pageSize: 1 })

    expect(report.applied).toBe(false)
    expect(report.pilots).toMatchObject({
      scanned: 2,
      changed: 1,
      workspaceIdStripped: 1,
      gameIdStamped: 1,
      pilotRefsSlugged: 1,
      unparseable: [ids.unparseable],
    })
    expect(report.mechs).toMatchObject({
      scanned: 2,
      changed: 1,
      descriptionMoved: 1,
      mechRefsSlugged: 1,
      unresolvedRefs: [ids.unresolved],
    })
    expect(report.crawlers).toMatchObject({
      scanned: 1,
      changed: 1,
      workspaceIdStripped: 1,
      gameIdStamped: 0,
      ownerIdBackfilled: 1,
      typeSlugged: 1,
      bayRefSlugged: 1,
      crawlerSystemsSlugged: 1,
      bayChoicesRekeyed: 1,
    })
    expect(report.mechPatterns).toMatchObject({ scanned: 1, changed: 1, mechRefsSlugged: 1 })
    expect(report.softLinks).toEqual({ scanned: 2, orphanedLinksDeleted: 1 })
    expect(await snapshot(t)).toEqual(before)
  })

  test('apply rewrites the rows, and a second apply has nothing left to do', async () => {
    const t = testConvex()
    const ids = await seed(t)
    const before = await snapshot(t)

    await t.action(internal.legacyRows.rewrite, { apply: true, pageSize: 1 })

    const rows = await t.run(async (ctx) => ({
      pilot: await ctx.db.get(ids.pilot),
      mech: await ctx.db.get(ids.mech),
      crawler: await ctx.db.get(ids.crawler),
      pattern: await ctx.db.get(ids.pattern),
      kept: await ctx.db.get(ids.kept),
      orphan: await ctx.db.get(ids.orphan),
    }))

    const pilot = rows.pilot?.body
    expect(pilot).not.toHaveProperty('workspaceId')
    expect(pilot).toMatchObject({
      gameId: null,
      abilities: [getEntitySlug(ability)],
      usedAbilities: [getEntitySlug(ability)],
      equipment: [getEntitySlug(item)],
      equipmentConditions: { [getEntitySlug(item)]: 'damaged' },
      partners: [
        {
          id: 'partner-1',
          hostRef: getEntitySlug(item),
          systems: [getEntitySlug(system)],
          modules: [getEntitySlug(mechModule)],
          systemConditions: { [getEntitySlug(system)]: 'damaged' },
          itemUses: { [getEntitySlug(mechModule)]: 1 },
        },
      ],
    })
    expect(rows.pilot?.updatedAt).toBeGreaterThan(1)

    const mech = rows.mech?.body
    expect(mech).not.toHaveProperty('description')
    expect(mech).toMatchObject({
      appearance: 'Rust-red',
      chassisRef: getEntitySlug(chassis),
      systems: [getEntitySlug(system)],
      systemConditions: { [getEntitySlug(system)]: 'damaged' },
      partners: [
        {
          id: 'partner-2',
          hostRef: getEntitySlug(drone),
          modules: [getEntitySlug(mechModule)],
          moduleConditions: { [getEntitySlug(mechModule)]: 'destroyed' },
        },
      ],
    })

    expect(rows.crawler?.ownerId).toBeNull()
    const crawler = rows.crawler?.body
    expect(crawler).not.toHaveProperty('workspaceId')
    expect(crawler).toMatchObject({
      type: getEntitySlug(crawlerType),
      crawlerBays: [{ bayRef: getEntitySlug(bay), npcName: 'Doc' }],
      systems: [getEntitySlug(system)],
      bayChoices: {
        [getEntitySlug(bay)]: { Keepsake: ['a coin'] },
        [getEntitySlug(crawlerType)]: { Motto: ['onward'] },
      },
    })

    expect(rows.pattern?.body).toMatchObject({ modules: [getEntitySlug(mechModule)] })
    expect(rows.kept).not.toBeNull()
    expect(rows.orphan).toBeNull()

    // The rows the rewrite could not finish are exactly as they were.
    const after = await snapshot(t)
    for (const id of [ids.unparseable, ids.unresolved]) {
      const all = [...after.pilots, ...after.mechs]
      const was = [...before.pilots, ...before.mechs]
      expect(all.find((row) => row._id === id)).toEqual(was.find((row) => row._id === id))
    }

    const again = await t.action(internal.legacyRows.rewrite, { apply: true })
    for (const table of ['pilots', 'mechs', 'crawlers', 'mechPatterns'] as const) {
      expect(again[table].changed).toBe(0)
    }
    expect(again.softLinks.orphanedLinksDeleted).toBe(0)
    // Still reported, still untouched: the owner fixes these by hand.
    expect(again.mechs.unresolvedRefs).toEqual([ids.unresolved])
    expect(again.pilots.unparseable).toEqual([ids.unparseable])
  })
})

describe('canonicalRow', () => {
  test('drops a blank mech description, and one the appearance already supersedes', () => {
    for (const body of [
      mechBody({ description: '  ' }),
      mechBody({ description: 'old', appearance: 'new' }),
    ]) {
      const next = canonicalRow('mechs', { body, gameId: null, ownerId: null })
      expect(next?.changes).toEqual(['descriptionDropped'])
      expect(next?.body).not.toHaveProperty('description')
      expect(next?.body.appearance).toBe(body.appearance)
    }
  })

  test('changes nothing on a canonical row', () => {
    const next = canonicalRow('crawlers', {
      body: crawlerBody({ gameId: null, type: getEntitySlug(crawlerType) }),
      gameId: null,
      ownerId: null,
    })
    expect(next?.changes).toEqual([])
    expect(next?.bodyChanged).toBe(false)
  })

  test('a body that is not an object has no canonical form', () => {
    expect(canonicalRow('pilots', { body: 'pilot', gameId: null })).toBeNull()
  })
})
