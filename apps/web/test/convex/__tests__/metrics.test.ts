import { afterEach, describe, expect, test } from 'bun:test'
import { api, internal } from '../../../convex/_generated/api'
import { adminDiscordIds } from '../../../convex/model/admin'
import { weekStartOf } from '../../../convex/model/usage'
import { addPilot, makeUser, seedTable } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Usage metrics (ADR-056): aggregate counts only, for the admins
 * `ADMIN_DISCORD_IDS` names and nobody else.
 */

afterEach(() => {
  delete process.env.ADMIN_DISCORD_IDS
})

describe('who may read the metrics', () => {
  test('only an account whose Discord id is listed', async () => {
    process.env.ADMIN_DISCORD_IDS = ' d-admin , '
    const t = testConvex()
    const admin = await makeUser(t, 'Admin', 'd-admin')
    const player = await makeUser(t, 'Player', 'd-player')
    expect(await admin.as.query(api.metrics.forAdmin, {})).not.toBeNull()
    expect(await player.as.query(api.metrics.forAdmin, {})).toBeNull()
    expect(await t.query(api.metrics.forAdmin, {})).toBeNull()
    await expect(player.as.mutation(api.metrics.refresh, {})).rejects.toThrow('Admins only')
  })

  test('unset, nobody is an admin', () => {
    expect(adminDiscordIds(undefined).size).toBe(0)
    expect([...adminDiscordIds('a, b,,')]).toEqual(['a', 'b'])
  })
})

describe('the tally', () => {
  test('counts accounts, sheets and Games that play together', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    await addPilot(organizer, 'p-1', gameId)
    await addPilot(organizer, 'p-2', null)
    const solo = await makeUser(t, 'Solo')
    await solo.as.mutation(api.games.create, { name: 'Alone' })

    await t.mutation(internal.metrics.tally, {})
    await t.finishAllScheduledFunctions(() => {})

    const read = await t.query(internal.metrics.report, {})
    expect(read.snapshot?.counts).toMatchObject({
      accounts: 3,
      pilots: 2,
      games: 2,
      sharedGames: 1,
    })
  })

  test('the bot’s commands are tallied by week and name, and its servers counted', async () => {
    const t = testConvex()
    await t.mutation(internal.botClient.usage, { name: 'su roll', guildId: 'g-1' })
    await t.mutation(internal.botClient.usage, { name: 'su roll', guildId: 'g-2' })
    await t.mutation(internal.botClient.usage, { name: 'su lookup' })
    await t.mutation(internal.metrics.tally, {})
    await t.finishAllScheduledFunctions(() => {})

    const read = await t.query(internal.metrics.report, {})
    expect(read.weeks).toHaveLength(1)
    expect(read.weeks[0]?.counts).toEqual({ 'bot:su roll': 2, 'bot:su lookup': 1 })
    expect(read.snapshot?.counts).toMatchObject({ botGuilds: 2, botGuildsThisWeek: 2 })
  })

  test('a Downtime begun counts once', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    await organizer.as.mutation(api.downtime.begin, { gameId })
    // Already running: a second press is no new Downtime.
    await organizer.as.mutation(api.downtime.begin, { gameId })
    const read = await t.query(internal.metrics.report, {})
    expect(read.weeks[0]?.counts).toEqual({ 'downtime:game': 1 })
  })
})

describe('weeks', () => {
  test('start on Monday at midnight UTC', () => {
    // Thursday 22 October 2026, 04:38 UTC.
    const at = Date.UTC(2026, 9, 22, 4, 38)
    expect(new Date(weekStartOf(at)).toISOString()).toBe('2026-10-19T00:00:00.000Z')
    expect(weekStartOf(Date.UTC(2026, 9, 19))).toBe(Date.UTC(2026, 9, 19))
  })
})
