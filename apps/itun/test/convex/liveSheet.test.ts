import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import {
  addCrawler,
  addMech,
  addPilot,
  link,
  makeUser,
  pilotBody,
  ref,
  seedTable,
} from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * The server half of "one way to view an entity, always live".
 *
 *  - `entities.locate` tells the live sheet route where an entity lives and
 *    whether the caller may edit it — with exactly the visibility the Game and
 *    shelf queries already grant, and nothing more.
 *  - `publicSheet.get` serves a published entity's assignments: every linked
 *    entity by kind and name, and its body ONLY when that entity is published
 *    itself.
 */

/** A Game with a crawler, a player's pilot crewing it, and the organizer's mech flying that pilot. */
async function seedCrew() {
  const t = testConvex()
  const { organizer, player, gameId } = await seedTable(t)
  // The first crawler is the primary: everyone who arrives after is assigned to it.
  await addCrawler(organizer, 'c1', gameId)
  await addPilot(player, 'p1', gameId)
  await addMech(organizer, 'm1', gameId)
  await link(organizer, ref.mech('m1'), ref.pilot('p1'), 'mech-to-pilot')
  return { t, organizer, player, gameId }
}

describe('entities.locate', () => {
  test('your own entity: its Game, and yours to edit', async () => {
    const { player, gameId } = await seedCrew()
    expect(await player.as.query(api.entities.locate, { kind: 'pilot', id: 'p1' })).toEqual({
      id: 'p1',
      gameId,
      mayEdit: true,
    })
  })

  test("a crewmate's entity: readable, not editable", async () => {
    const { player, gameId } = await seedCrew()
    expect(await player.as.query(api.entities.locate, { kind: 'mech', id: 'm1' })).toEqual({
      id: 'm1',
      gameId,
      mayEdit: false,
    })
  })

  test('the crew’s crawler is every member’s to edit', async () => {
    const { player, gameId } = await seedCrew()
    expect(await player.as.query(api.entities.locate, { kind: 'crawler', id: 'c1' })).toEqual({
      id: 'c1',
      gameId,
      mayEdit: true,
    })
  })

  test('your own shelf entity has no Game', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await addPilot(me, 'solo', null)
    expect(await me.as.query(api.entities.locate, { kind: 'pilot', id: 'solo' })).toEqual({
      id: 'solo',
      gameId: null,
      mayEdit: true,
    })
  })

  test('a non-member, a stranger’s shelf, and no row at all read the same', async () => {
    const { t } = await seedCrew()
    const stranger = await makeUser(t, 'Stranger')
    const other = await makeUser(t, 'Other')
    await addPilot(other, 'theirs', null)

    expect(await stranger.as.query(api.entities.locate, { kind: 'pilot', id: 'p1' })).toBeNull()
    expect(await stranger.as.query(api.entities.locate, { kind: 'pilot', id: 'theirs' })).toBeNull()
    expect(await stranger.as.query(api.entities.locate, { kind: 'pilot', id: 'nope' })).toBeNull()
  })

  test('signed out is null, not a throw — it backs a reactive query', async () => {
    const { t } = await seedCrew()
    expect(await t.query(api.entities.locate, { kind: 'pilot', id: 'p1' })).toBeNull()
  })

  test('a Convex row id (the retired crew-view URL) resolves to the app id', async () => {
    const { t, player } = await seedCrew()
    const rowId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('pilots')
        .withIndex('by_app_id', (q) => q.eq('appId', 'p1'))
        .unique()
      return row?._id ?? ''
    })
    const located = await player.as.query(api.entities.locate, { kind: 'pilot', id: rowId })
    expect(located?.id).toBe('p1')
  })

  test('a template pre-gen with no app id is found by its body id in your Game', async () => {
    const { t, player, gameId } = await seedCrew()
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: null,
        body: pilotBody('tmpl-1', gameId),
        updatedAt: Date.now(),
      })
    })
    expect(await player.as.query(api.entities.locate, { kind: 'pilot', id: 'tmpl-1' })).toEqual({
      id: 'tmpl-1',
      gameId,
      mayEdit: false,
    })
  })
})

describe('publicSheet.get serves assignments, never a private body', () => {
  test('a published pilot names its mech and crawler', async () => {
    const { t, player } = await seedCrew()
    await player.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'p1',
      isPublic: true,
    })

    const result = await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'p1' })
    expect(result?.links).toEqual(
      expect.arrayContaining([
        { type: 'mech-to-pilot', from: ref.mech('m1'), to: ref.pilot('p1') },
        { type: 'pilot-to-crawler', from: ref.pilot('p1'), to: ref.crawler('c1') },
      ])
    )
    // Named — and nothing else, because neither is published.
    expect(result?.linked).toEqual(
      expect.arrayContaining([
        { kind: 'mech', id: 'm1', name: 'Mech m1' },
        { kind: 'crawler', id: 'c1', name: 'Crawler c1' },
      ])
    )
    expect(result?.linked.some((unit) => 'body' in unit)).toBe(false)
  })

  test('a linked entity that is published itself comes with its body', async () => {
    const { t, organizer, player } = await seedCrew()
    await player.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'p1',
      isPublic: true,
    })
    // The crawler is the table runner's to publish (ADR-032).
    await organizer.as.mutation(api.publicSheet.setPublic, {
      kind: 'crawler',
      appId: 'c1',
      isPublic: true,
    })

    const result = await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'p1' })
    const crawler = result?.linked.find((unit) => unit.id === 'c1')
    const mech = result?.linked.find((unit) => unit.id === 'm1')
    expect((crawler?.body as { name?: string } | undefined)?.name).toBe('Crawler c1')
    expect(mech !== undefined && 'body' in mech).toBe(false)
  })

  test('a link reaching outside the container is not an assignment to disclose', async () => {
    const { t, player } = await seedCrew()
    const stranger = await makeUser(t, 'Stranger')
    await addMech(stranger, 'mx', null)
    // Forged, or older than the one-container rule: the stranger's shelf mech
    // "flying" a pilot in somebody else's Game.
    await t.run(async (ctx) => {
      await ctx.db.insert('softLinks', {
        gameId: null,
        from: ref.mech('mx'),
        to: ref.pilot('p1'),
        type: 'mech-to-pilot',
      })
    })
    await player.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'p1',
      isPublic: true,
    })

    const result = await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'p1' })
    expect(result?.linked.map((unit) => unit.id)).not.toContain('mx')
    expect(result?.links.map((l) => l.from.id)).not.toContain('mx')
  })

  test("a published pilot's abilities reach a published mech it flies", async () => {
    const { t, organizer, player, gameId } = await seedCrew()
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId,
      body: { ...pilotBody('p1', gameId), abilities: ['beefcake'] },
    })
    await organizer.as.mutation(api.publicSheet.setPublic, {
      kind: 'mech',
      appId: 'm1',
      isPublic: true,
    })

    // A claimed crewmate's private pilot: their abilities stay theirs.
    const privatePilot = await t.query(api.publicSheet.get, { kind: 'mech', appId: 'm1' })
    expect(privatePilot?.pilotAbilities).toEqual([])

    // Published in their own right: nothing left to withhold.
    await player.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'p1',
      isPublic: true,
    })
    const publicPilot = await t.query(api.publicSheet.get, { kind: 'mech', appId: 'm1' })
    expect(publicPilot?.pilotAbilities).toEqual(['beefcake'])
  })
})
