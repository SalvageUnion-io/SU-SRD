import { describe, expect, test } from 'bun:test'
import type { Encounter } from 'game-domain/schemas/encounter'
import { api } from '../../../convex/_generated/api'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * The Mediator's prep kit (ADR-059): encounters on a shelf, and running one
 * in a Game. An encounter is its maker's alone, and what a Game runs is a
 * copy that stays as secret as the tray it lands on.
 */

const STAMP = '2026-10-22T00:00:00.000Z'

/** An encounter with two opponents, two tables and notes. */
function ambush(id = 'enc-1'): Encounter {
  return {
    id,
    schemaVersion: 1,
    name: 'Ambush at the Scrap Yard',
    opposition: [
      {
        id: 'o1',
        refSchema: 'squads',
        refSlug: 'raider-band',
        refName: 'Raider Band',
        name: 'Raider Band',
        maxHp: 6,
        statKind: 'hp',
      },
      {
        id: 'o2',
        refSchema: 'npcs',
        refSlug: 'raider',
        refName: 'Raider',
        name: 'Raider',
        maxHp: 3,
        statKind: 'hp',
      },
    ],
    tables: ['Reaction Roll', 'Morale'],
    notes: 'The Band waits behind the crusher.',
    createdAt: STAMP,
    updatedAt: STAMP,
  }
}

/** A Game the first user mediates, with a plain player in it. */
async function seedMediatedGame(t: Ctx) {
  const mediator = await makeUser(t, 'Mediator')
  const player = await makeUser(t, 'Player')
  const gameId = await mediator.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await mediator.as.mutation(api.invites.link, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await mediator.as.mutation(api.games.setMediator, {
    gameId,
    userId: mediator.userId,
    mediator: true,
  })
  return { mediator, player, gameId }
}

describe('encounters on a shelf', () => {
  test('the same write twice is one encounter, and only its maker reads it', async () => {
    const t = testConvex()
    const mine = await makeUser(t, 'Mediator')
    const other = await makeUser(t, 'Other')
    await mine.as.mutation(api.shelf.upsertEncounter, { body: ambush() })
    await mine.as.mutation(api.shelf.upsertEncounter, { body: { ...ambush(), notes: 'Edited' } })

    const rows = await mine.as.query(api.shelf.encounters, {})
    expect(rows).toHaveLength(1)
    expect(rows.map((row) => (row.body as Encounter).notes)).toEqual(['Edited'])
    expect(await other.as.query(api.shelf.encounters, {})).toEqual([])
  })

  test('a malformed body is refused rather than stored', async () => {
    const t = testConvex()
    const mine = await makeUser(t, 'Mediator')
    for (const body of [{ ...ambush(), name: '  ' }, { ...ambush(), bogus: true }, 'Ambush']) {
      await expect(mine.as.mutation(api.shelf.upsertEncounter, { body })).rejects.toThrow(
        /invalid encounters payload|must carry a string id/i
      )
    }
    const rows = await t.run(async (ctx) => await ctx.db.query('encounters').collect())
    expect(rows).toHaveLength(0)
  })

  test('remove deletes only the caller’s own', async () => {
    const t = testConvex()
    const mine = await makeUser(t, 'Mediator')
    const other = await makeUser(t, 'Other')
    await mine.as.mutation(api.shelf.upsertEncounter, { body: ambush() })
    await other.as.mutation(api.shelf.removeEncounter, { encounterId: 'enc-1' })
    expect(await mine.as.query(api.shelf.encounters, {})).toHaveLength(1)
    await mine.as.mutation(api.shelf.removeEncounter, { encounterId: 'enc-1' })
    expect(await mine.as.query(api.shelf.encounters, {})).toEqual([])
  })
})

describe('running an encounter in a Game', () => {
  test('its opposition joins the tray at full HP, named apart, and its notes run', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'Raider' } })
    await mediator.as.mutation(api.shelf.upsertEncounter, { body: ambush() })

    const { added } = await mediator.as.mutation(api.mediator.runEncounter, {
      gameId,
      encounterId: 'enc-1',
      clear: false,
    })
    expect(added).toBe(2)

    const tray = await mediator.as.query(api.mediator.npcs, { gameId })
    const names = tray.map((row) => (row.body as { name: string }).name).sort()
    expect(names).toEqual(['Raider', 'Raider 2', 'Raider Band'])
    const band = tray.find((row) => (row.body as { name: string }).name === 'Raider Band')
    expect(band?.body).toMatchObject({ currentHp: 6, maxHp: 6, conditions: [] })

    const running = await mediator.as.query(api.mediator.running, { gameId })
    expect(running).toMatchObject({
      encounterId: 'enc-1',
      name: 'Ambush at the Scrap Yard',
      tables: ['Reaction Roll', 'Morale'],
      notes: 'The Band waits behind the crusher.',
    })
    // A copy: the shelf encounter is as it was.
    expect(await mediator.as.query(api.shelf.encounters, {})).toEqual([{ body: ambush() }])
  })

  test('clear empties the tray first, and a second run replaces the running one', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'Wretch' } })
    await mediator.as.mutation(api.shelf.upsertEncounter, { body: ambush() })
    await mediator.as.mutation(api.shelf.upsertEncounter, {
      body: { ...ambush('enc-2'), name: 'The Ace Comes Calling', opposition: [] },
    })

    await mediator.as.mutation(api.mediator.runEncounter, {
      gameId,
      encounterId: 'enc-1',
      clear: true,
    })
    const tray = await mediator.as.query(api.mediator.npcs, { gameId })
    expect(tray.map((row) => (row.body as { name: string }).name).sort()).toEqual([
      'Raider',
      'Raider Band',
    ])

    await mediator.as.mutation(api.mediator.runEncounter, {
      gameId,
      encounterId: 'enc-2',
      clear: false,
    })
    expect(await mediator.as.query(api.mediator.running, { gameId })).toMatchObject({
      name: 'The Ace Comes Calling',
    })
    const rows = await t.run(async (ctx) => await ctx.db.query('runningEncounters').collect())
    expect(rows).toHaveLength(1)
  })

  test('End stops it and leaves the Opposition on the tray', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.shelf.upsertEncounter, { body: ambush() })
    await mediator.as.mutation(api.mediator.runEncounter, {
      gameId,
      encounterId: 'enc-1',
      clear: false,
    })
    await mediator.as.mutation(api.mediator.endEncounter, { gameId })
    expect(await mediator.as.query(api.mediator.running, { gameId })).toBeNull()
    expect(await mediator.as.query(api.mediator.npcs, { gameId })).toHaveLength(2)
  })

  test('players can neither read nor run it, and nobody runs another’s encounter', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.shelf.upsertEncounter, { body: ambush() })
    await player.as.mutation(api.shelf.upsertEncounter, { body: ambush('theirs') })
    await mediator.as.mutation(api.mediator.runEncounter, {
      gameId,
      encounterId: 'enc-1',
      clear: false,
    })

    await expect(player.as.query(api.mediator.running, { gameId })).rejects.toThrow(/mediator/i)
    await expect(
      player.as.mutation(api.mediator.runEncounter, { gameId, encounterId: 'theirs', clear: false })
    ).rejects.toThrow(/mediator/i)
    await expect(player.as.mutation(api.mediator.endEncounter, { gameId })).rejects.toThrow(
      /mediator/i
    )
    // The Mediator runs only their own shelf's.
    await expect(
      mediator.as.mutation(api.mediator.runEncounter, {
        gameId,
        encounterId: 'theirs',
        clear: false,
      })
    ).rejects.toThrow(/not on your shelf/i)
  })

  test('deleting the Game takes its running encounter with it', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.shelf.upsertEncounter, { body: ambush() })
    await mediator.as.mutation(api.mediator.runEncounter, {
      gameId,
      encounterId: 'enc-1',
      clear: false,
    })
    await mediator.as.mutation(api.games.destroy, { gameId })
    const rows = await t.run(async (ctx) => await ctx.db.query('runningEncounters').collect())
    expect(rows).toHaveLength(0)
    // The shelf encounter is the Mediator's, and stays.
    expect(await mediator.as.query(api.shelf.encounters, {})).toHaveLength(1)
  })
})
