import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GAME_APPARATUS_TABLES } from '../../../convex/model/seats'
import schema from '../../../convex/schema'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Tearing a Game down, by `games.destroy` or by its last member deleting their
 * account, goes through one helper, `deleteGameApparatus`, so both paths clear
 * every table that names the Game — `channelBindings` included, which a
 * hand-written list of tables is easy to forget.
 */

/**
 * Tables with a `gameId` column that the teardown deliberately leaves alone.
 *
 * Each path shelves (destroy) or deletes (last member out) the entities itself
 * before the teardown runs, because what happens to something somebody built
 * depends on the path. `changeLog` and `ops` are history, and outlive the Game
 * they were written in.
 */
const EXEMPT = [
  'pilots',
  'mechs',
  'crawlers',
  'npcs',
  'encounterNpcs',
  'mechPatterns',
  'changeLog',
  'ops',
]

/** A Discord channel bound to `gameId`, as a binding row already in the database is. */
async function bindChannel(t: Ctx, gameId: Id<'games'>, channelId: string, boundBy: Id<'users'>) {
  await t.run(async (ctx) => {
    await ctx.db.insert('channelBindings', { gameId, channelId, boundBy, boundAt: Date.now() })
  })
}

/** Every row, in every apparatus table, that still names `gameId`. */
async function apparatusLeftFor(t: Ctx, gameId: Id<'games'>) {
  return await t.run(async (ctx) => {
    const left: string[] = []
    for (const table of GAME_APPARATUS_TABLES) {
      const rows = await ctx.db.query(table).collect()
      if (rows.some((row) => row.gameId === gameId)) left.push(table)
    }
    return left
  })
}

describe('every table with a gameId column is accounted for', () => {
  test('torn down with the Game, or exempted by name', () => {
    const withGameId = Object.entries(schema.tables)
      .filter(([, table]) => 'gameId' in table.validator.fields)
      .map(([name]) => name)
      .sort()
    const accounted = [...GAME_APPARATUS_TABLES, ...EXEMPT].sort()

    // A new table with a `gameId` column fails here until somebody decides
    // whether it goes with the Game, rather than stranding rows by default.
    expect(withGameId).toEqual(accounted)
  })
})

describe('destroying a Game frees its Discord channel', () => {
  test('the binding goes with the Game', async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
    await bindChannel(t, gameId, 'chan-1', organizer.userId)

    await organizer.as.mutation(api.games.destroy, { gameId })
    expect(await apparatusLeftFor(t, gameId)).toEqual([])
  })
})

describe('the last member out tears the Game down the same way', () => {
  test('its binding goes with it', async () => {
    const t = testConvex()
    const solo = await makeUser(t, 'Solo')

    const gameId = await solo.as.mutation(api.games.create, { name: 'Alone' })
    await bindChannel(t, gameId, 'chan-solo', solo.userId)

    await solo.as.mutation(api.account.deleteAccount, {})

    expect(await t.run(async (ctx) => await ctx.db.get(gameId))).toBeNull()
    expect(await apparatusLeftFor(t, gameId)).toEqual([])
  })
})

describe('destroying a Game shelves every entity row by one rule', () => {
  test('owned rows keep their owner; ownerless ones go to the deleting Organizer', async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const player = await makeUser(t, 'Player')
    const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })

    // A pilot with an owner, then one row of every kind that can sit in a Game
    // with `ownerId: null` (crawlers and tray NPCs always do).
    const ids = await t.run(async (ctx) => ({
      owned: await ctx.db.insert('pilots', {
        gameId,
        ownerId: player.userId,
        body: {},
        updatedAt: 1,
      }),
      pilot: await ctx.db.insert('pilots', { gameId, ownerId: null, body: {}, updatedAt: 1 }),
      mech: await ctx.db.insert('mechs', { gameId, ownerId: null, body: {}, updatedAt: 1 }),
      npc: await ctx.db.insert('npcs', { gameId, ownerId: null, body: {}, updatedAt: 1 }),
      crawler: await ctx.db.insert('crawlers', { gameId, ownerId: null, body: {}, updatedAt: 1 }),
      tray: await ctx.db.insert('encounterNpcs', {
        gameId,
        ownerId: null,
        appId: 'tray-1',
        body: { id: 'tray-1' },
      }),
    }))

    await organizer.as.mutation(api.games.destroy, { gameId })

    const landed = await t.run(async (ctx) => {
      const where = async (id: Id<'pilots' | 'mechs' | 'npcs' | 'crawlers' | 'encounterNpcs'>) => {
        const row = await ctx.db.get(id)
        return row === null ? null : { gameId: row.gameId, ownerId: row.ownerId }
      }
      return {
        owned: await where(ids.owned),
        pilot: await where(ids.pilot),
        mech: await where(ids.mech),
        npc: await where(ids.npc),
        crawler: await where(ids.crawler),
        tray: await where(ids.tray),
      }
    })
    const organizers = { gameId: null, ownerId: organizer.userId }
    expect(landed).toEqual({
      owned: { gameId: null, ownerId: player.userId },
      pilot: organizers,
      mech: organizers,
      npc: organizers,
      crawler: organizers,
      tray: organizers,
    })
  })
})
