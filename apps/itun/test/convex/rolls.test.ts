import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { rollLogEntry } from '../../src/components/dashboard/dashboardRolls'
import { addPilot, makeUser, seedTable } from './fixtures'
import { testConvex } from './harness'

/**
 * Rolls on the Game's log (ADR-038 §2): the Dashboard writes them through
 * `appendChangeLog`, in the row shape `rollLogEntry` builds, and the Log tab
 * reads them back through `changeLog.rolls`, beside the Discord bot's.
 */

const crush = {
  description: 'Rook · Crush: 14, Success',
  result: { kind: 'core' as const, roll: 14, outcome: 'success' },
}

describe('a Dashboard roll round-trips through the log', () => {
  test('appended as a member, read back by a crewmate, newest first', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)

    await player.as.mutation(api.changeLog.appendChangeLog, {
      entries: [rollLogEntry(gameId, crush, 100)],
    })
    await player.as.mutation(api.changeLog.appendChangeLog, {
      entries: [
        rollLogEntry(
          gameId,
          {
            description: 'Scrapper · Heat Check 7 vs Heat 3: no overload',
            result: { kind: 'heat-check', roll: 7, outcome: 'safe' },
          },
          200
        ),
      ],
    })

    const rolls = await organizer.as.query(api.changeLog.rolls, { gameId })
    expect(rolls.map((r) => r.description)).toEqual([
      'Scrapper · Heat Check 7 vs Heat 3: no overload',
      'Rook · Crush: 14, Success',
    ])
    expect(rolls[1]).toMatchObject({ ts: 100, source: 'dashboard', actorName: 'Player' })

    // The row is the bot's shape: a Game row, not anybody's sheet.
    const row = await t.run(async (ctx) => await ctx.db.query('changeLog').first())
    expect(row).toMatchObject({
      gameId,
      entityType: 'game',
      entityId: gameId,
      field: 'roll',
      kind: 'transaction',
      state: 'applied',
      after: crush,
    })
  })

  test('only rolls: alerts and sheet edits stay out', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    await organizer.as.mutation(api.proposals.broadcast, { gameId, message: 'Bio-Titan closing' })
    await addPilot(player, 'p-rook', gameId)
    await player.as.mutation(api.changeLog.appendChangeLog, {
      entries: [
        {
          ...rollLogEntry(gameId, crush, 1),
          field: 'currentHP',
          entityType: 'pilot',
          entityId: 'p-rook',
        },
      ],
    })
    expect(await player.as.query(api.changeLog.rolls, { gameId })).toEqual([])
  })

  // The row `botClient.recordRoll` writes, seeded directly: its own suite
  // (`bot.test.ts`) covers how it gets there.
  test("the bot's rolls read the same way", async () => {
    const t = testConvex()
    const { gameId } = await seedTable(t)
    const reader = await makeUser(t, 'Reader')
    await t.run(async (ctx) => {
      await ctx.db.insert('memberships', {
        gameId,
        userId: reader.userId,
        mediator: false,
        organizer: false,
        joinedAt: 0,
      })
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('changeLog', {
        gameId,
        entityType: 'game',
        entityId: gameId,
        ts: 5,
        kind: 'transaction',
        field: 'roll',
        before: null,
        after: { description: 'Core Mechanic', result: { total: 12 } },
        source: 'discord-bot',
        actorId: reader.userId,
        state: 'applied',
      })
    })
    expect(await reader.as.query(api.changeLog.rolls, { gameId })).toMatchObject([
      { description: 'Core Mechanic', source: 'discord-bot', actorName: 'Reader' },
    ])
  })

  test('a non-member reads nothing, and the limit is capped', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await expect(stranger.as.query(api.changeLog.rolls, { gameId })).rejects.toThrow(
      /not a member/i
    )

    await player.as.mutation(api.changeLog.appendChangeLog, {
      entries: Array.from({ length: 3 }, (_, i) => rollLogEntry(gameId, crush, i)),
    })
    expect(await player.as.query(api.changeLog.rolls, { gameId, limit: 2 })).toHaveLength(2)
    expect(await player.as.query(api.changeLog.rolls, { gameId, limit: -5 })).toHaveLength(0)
  })
})
