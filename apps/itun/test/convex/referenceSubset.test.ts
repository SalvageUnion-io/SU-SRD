import { afterEach, describe, expect, test } from 'bun:test'
import { nameToSlug, resetAllForTesting, SalvageUnionReference } from 'salvageunion-reference'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { Ctx, User } from './assignmentFixtures'
import { addCrawler, link, mechBody, pilotBody, ref, seedTable } from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * The Convex functions that derive from reference data, run on the schemas a
 * deployment actually has.
 *
 * Every other suite here runs after `test/reference-preload.ts` has loaded all
 * the schemas, while the deployed backend has only the few that
 * `convex/model/referenceData.ts` installs. A derivation that starts reading
 * one more model would pass those suites and throw `SchemaNotLoadedError` in
 * production. So each test here builds its records with everything loaded,
 * takes the function's answer, then resets the ORM (`resetAllForTesting`) so
 * the function's own `loadReferenceData()` is all it has, and asks again. The
 * second answer must not throw and must equal the first: a lookup that
 * silently comes back empty on a missing schema fails here too.
 *
 * The records cover every chassis and every class, each pilot holding its
 * whole class's abilities and each mech flown by one of them, with every
 * system and module installed and destroyed so a mech's status names each.
 */

afterEach(async () => {
  // The loaded-schema set is module-global; hand every later file the full set
  // the shared preload promised it.
  resetAllForTesting()
  await SalvageUnionReference.preload('all')
})

/** Reset to nothing, so the call under test loads only what Convex bundles. */
function deployedSchemasOnly() {
  resetAllForTesting()
  expect(SalvageUnionReference.isLoaded('chassis')).toBe(false)
}

/** Each class as a pilot holding every ability in its trees, crewing one crawler. */
async function seedPilots(player: User, organizer: User, gameId: Id<'games'>) {
  await addCrawler(organizer, 'crawler-1', gameId)
  const abilities = SalvageUnionReference.Abilities.all()
  const pilotIds: string[] = []
  for (const cls of SalvageUnionReference.Classes.all()) {
    // A hybrid class has no core trees; the Salvager has no advanced ones.
    const trees = new Set([
      ...('coreTrees' in cls ? cls.coreTrees : []),
      'advancedTree' in cls ? cls.advancedTree : undefined,
      'legendaryTree' in cls ? cls.legendaryTree : undefined,
    ])
    const id = `pilot-${nameToSlug(cls.name)}`
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: id,
      gameId,
      body: {
        ...pilotBody(id, gameId),
        classRef: nameToSlug(cls.name),
        abilities: abilities.filter((a) => trees.has(a.tree)).map((a) => nameToSlug(a.name)),
      },
      expectedUpdatedAt: null,
    })
    await link(player, ref.pilot(id), ref.crawler('crawler-1'), 'pilot-to-crawler')
    pilotIds.push(id)
  }
  return pilotIds
}

/** Every ref, each marked `destroyed`. */
function allDestroyed(refs: string[]) {
  return Object.fromEntries(refs.map((r) => [r, 'destroyed' as const]))
}

/**
 * Each chassis as a mech with every system and module installed and destroyed,
 * assigned to a pilot in turn. Destroyed items send `crew.vitals` through the
 * status's system and module lookups by name.
 */
async function seedMechs(player: User, gameId: Id<'games'>, pilotIds: string[]) {
  const systems = SalvageUnionReference.Systems.all().map((s) => nameToSlug(s.name))
  const modules = SalvageUnionReference.Modules.all().map((m) => nameToSlug(m.name))
  const chassis = SalvageUnionReference.Chassis.all()
  for (const [i, c] of chassis.entries()) {
    const id = `mech-${nameToSlug(c.name)}`
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'mechs',
      appId: id,
      gameId,
      body: {
        ...mechBody(id, gameId),
        chassisRef: nameToSlug(c.name),
        systems,
        modules,
        systemConditions: allDestroyed(systems),
        moduleConditions: allDestroyed(modules),
      },
      expectedUpdatedAt: null,
    })
    const pilotId = pilotIds[i % pilotIds.length]
    if (pilotId !== undefined) await link(player, ref.mech(id), ref.pilot(pilotId), 'mech-to-pilot')
  }
  return chassis.length
}

async function seedCrew(t: Ctx) {
  const { organizer, player, gameId } = await seedTable(t)
  const pilotIds = await seedPilots(player, organizer, gameId)
  const mechCount = await seedMechs(player, gameId, pilotIds)
  return { player, gameId, pilotCount: pilotIds.length, mechCount }
}

describe('Convex derives on the schemas it deploys', () => {
  test('crew.vitals: every class and every chassis', async () => {
    const t = testConvex()
    const { player, gameId, pilotCount, mechCount } = await seedCrew(t)

    const full = await player.as.query(api.crew.vitals, { gameId })
    // Not two empty lists agreeing, nor two rows of nulls.
    expect(full.pilots).toHaveLength(pilotCount)
    expect(full.mechs).toHaveLength(mechCount)
    expect(full.pilots.every((p) => p.maxHP !== null)).toBe(true)
    expect(full.mechs.every((m) => m.maxSP !== null)).toBe(true)
    expect(full.mechs.some((m) => (m.status?.destroyedSystems.length ?? 0) > 0)).toBe(true)
    expect(full.mechs.some((m) => (m.status?.destroyedModules.length ?? 0) > 0)).toBe(true)

    deployedSchemasOnly()
    expect(await player.as.query(api.crew.vitals, { gameId })).toEqual(full)
    expect(SalvageUnionReference.isLoaded('classes')).toBe(false)
  })

  test('downtime: begin, every step, and upkeep', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    const steps = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')?.steps ?? []
    const upkeepStep = steps.findIndex((s) => s.name === 'Upkeep & Upgrade')
    expect(upkeepStep).toBeGreaterThan(0)

    deployedSchemasOnly()
    await organizer.as.mutation(api.downtime.begin, { gameId })
    for (let i = 0; i < upkeepStep; i++) {
      await organizer.as.mutation(api.downtime.advance, { gameId })
    }
    expect(await organizer.as.mutation(api.downtime.spendUpkeep, { gameId })).toBe(true)
    // Advancing clamps at the last step, which reads the step count.
    for (let i = upkeepStep; i < steps.length; i++) {
      await organizer.as.mutation(api.downtime.advance, { gameId })
    }
    const state = await organizer.as.query(api.downtime.state, { gameId })
    expect(state.stepIndex).toBe(steps.length - 1)
    expect(state.upkeepSpent).toBe(true)
  })
})
