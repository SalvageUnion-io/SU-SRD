import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { GAME_APPARATUS_TABLES } from '../../convex/model/seats'
import schema from '../../convex/schema'
import type { Ctx } from './fixtures'
import { testConvex } from './harness'

/**
 * Tearing a Game down, by `games.destroy` or by its last member deleting their
 * account, goes through one helper: `deleteGameApparatus`.
 *
 * Before it, each path carried its own hand-written list of tables, and neither
 * list named `channelBindings`. A destroyed Game left its binding behind, and
 * `bindChannelAs` refused every later bind of that channel as "already bound to
 * another game", so the channel could never be used again.
 */

/**
 * Tables with a `gameId` column that the teardown deliberately leaves alone.
 *
 * Each path shelves (destroy) or deletes (last member out) the entities itself
 * before the teardown runs, because what happens to something somebody built
 * depends on the path. `changeLog` is history, and outlives the Game it was
 * written in.
 */
const EXEMPT = ['pilots', 'mechs', 'crawlers', 'npcs', 'encounterNpcs', 'mechPatterns', 'changeLog']

/** A user signed in with Discord, so the bot can resolve them. */
async function makeDiscordUser(t: Ctx, name: string, discordId: string) {
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('users', { name, displayName: name })
    await ctx.db.insert('authAccounts', {
      userId: id,
      provider: 'discord',
      providerAccountId: discordId,
    })
    return id
  })
  return { userId, as: t.withIdentity({ subject: userId }) }
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
  test('a channel bound to a destroyed Game binds to a new one', async () => {
    const t = testConvex()
    const organizer = await makeDiscordUser(t, 'Organizer', 'discord-organizer')
    const first = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
    const bound = await t.mutation(internal.botClient.bind, {
      discordId: 'discord-organizer',
      channelId: 'chan-1',
      gameId: first,
    })
    expect(bound).toMatchObject({ ok: true })

    await organizer.as.mutation(api.games.destroy, { gameId: first })
    expect(await apparatusLeftFor(t, first)).toEqual([])

    const second = await organizer.as.mutation(api.games.create, { name: 'Second Wind' })
    const rebound = await t.mutation(internal.botClient.bind, {
      discordId: 'discord-organizer',
      channelId: 'chan-1',
      gameId: second,
    })
    expect(rebound).toMatchObject({ ok: true })
  })
})

describe('the last member out tears the Game down the same way', () => {
  test('its binding goes with it, and so do their knocks elsewhere', async () => {
    const t = testConvex()
    const solo = await makeDiscordUser(t, 'Solo', 'discord-solo')
    const host = await makeDiscordUser(t, 'Host', 'discord-host')

    const gameId = await solo.as.mutation(api.games.create, { name: 'Alone' })
    await t.mutation(internal.botClient.bind, {
      discordId: 'discord-solo',
      channelId: 'chan-solo',
      gameId,
    })

    // A pending request at somebody else's door.
    const elsewhere = await host.as.mutation(api.games.create, { name: 'Elsewhere' })
    const gated = await host.as.mutation(api.invites.create, {
      gameId: elsewhere,
      requiresApproval: true,
    })
    await solo.as.mutation(api.invites.redeem, { code: gated })

    await solo.as.mutation(api.account.deleteAccount, {})

    expect(await t.run(async (ctx) => await ctx.db.get(gameId))).toBeNull()
    expect(await apparatusLeftFor(t, gameId)).toEqual([])
    const requests = await t.run(async (ctx) => await ctx.db.query('joinRequests').collect())
    expect(requests).toEqual([])
  })
})
