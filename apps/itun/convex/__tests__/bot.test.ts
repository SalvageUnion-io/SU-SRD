import { describe, expect, test } from 'bun:test'

import { api } from '../_generated/api'
import { testConvex } from './harness'

/**
 * The Discord bot as a Game participant (Phase 6).
 *
 * The old #165 called for a service-role key and RLS policies — a bot that can
 * act as anybody. These tests exist to prove this one cannot: every path
 * resolves the actor from a *linked* Discord identity that is a *member* of the
 * *bound* Game, and every failure of that chain is silent rather than
 * informative, because a public channel is the wrong place to announce who has
 * an account.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

async function seedBoundGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const player = await makeUser(t, 'Player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await organizer.as.mutation(api.bot.bindChannel, { gameId, channelId: 'chan-1' })
  await player.as.mutation(api.bot.linkDiscordId, { discordId: 'discord-player' })
  return { organizer, player, gameId }
}

describe('channel binding', () => {
  test('one game per channel', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedBoundGame(t)
    const other = await organizer.as.mutation(api.games.create, { name: 'Other' })

    // A channel meaning two games makes every roll in it ambiguous, and the
    // bot has no way to ask which was meant.
    await expect(
      organizer.as.mutation(api.bot.bindChannel, { gameId: other, channelId: 'chan-1' })
    ).rejects.toThrow(/already bound/i)

    // Re-binding the same pair is a no-op, not an error.
    await organizer.as.mutation(api.bot.bindChannel, { gameId, channelId: 'chan-1' })
  })

  test('only the Organizer may bind or unbind', async () => {
    const t = testConvex()
    const { player, gameId } = await seedBoundGame(t)

    await expect(
      player.as.mutation(api.bot.bindChannel, { gameId, channelId: 'chan-2' })
    ).rejects.toThrow(/organizer/i)
    await expect(
      player.as.mutation(api.bot.unbindChannel, { channelId: 'chan-1' })
    ).rejects.toThrow(/organizer/i)
  })

  test('resolves the game a channel speaks for', async () => {
    const t = testConvex()
    const { player, gameId } = await seedBoundGame(t)
    const found = await player.as.query(api.bot.gameForChannel, { channelId: 'chan-1' })
    expect(found?.gameId).toBe(gameId)
  })
})

describe('the bot cannot act as anybody', () => {
  test('a linked member roll is recorded, attributed to them', async () => {
    const t = testConvex()
    const { player, gameId } = await seedBoundGame(t)

    const ok = await player.as.mutation(api.bot.recordRoll, {
      channelId: 'chan-1',
      discordId: 'discord-player',
      description: 'Heat Check',
      result: { total: 14 },
    })
    expect(ok).toBe(true)

    const rolls = await player.as.query(api.bot.rolls, { gameId })
    expect(rolls).toHaveLength(1)
    expect(rolls[0]?.actorId).toBe(player.userId)
  })

  test('an unlinked Discord id records nothing', async () => {
    const t = testConvex()
    const { player } = await seedBoundGame(t)

    const ok = await player.as.mutation(api.bot.recordRoll, {
      channelId: 'chan-1',
      discordId: 'some-stranger',
      description: 'Heat Check',
      result: {},
    })
    // Silent, not an error: distinguishing "no account" from "not a member" in
    // a public channel would leak who has one.
    expect(ok).toBe(false)
  })

  test('a linked NON-member records nothing', async () => {
    const t = testConvex()
    const { player } = await seedBoundGame(t)
    const outsider = await makeUser(t, 'Outsider')
    await outsider.as.mutation(api.bot.linkDiscordId, { discordId: 'discord-outsider' })

    const ok = await player.as.mutation(api.bot.recordRoll, {
      channelId: 'chan-1',
      discordId: 'discord-outsider',
      description: 'Heat Check',
      result: {},
    })
    // Being in the Discord channel is not membership of the Game.
    expect(ok).toBe(false)
  })

  test('an unbound channel records nothing', async () => {
    const t = testConvex()
    const { player } = await seedBoundGame(t)

    const ok = await player.as.mutation(api.bot.recordRoll, {
      channelId: 'chan-nowhere',
      discordId: 'discord-player',
      description: 'Heat Check',
      result: {},
    })
    expect(ok).toBe(false)
  })
})

describe('linking a Discord identity', () => {
  test('two accounts cannot claim the same Discord id', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const impostor = await makeUser(t, 'Impostor')

    // Otherwise the bot would resolve rolls to whichever it found first.
    await expect(
      impostor.as.mutation(api.bot.linkDiscordId, { discordId: 'discord-player' })
    ).rejects.toThrow(/already linked/i)
  })

  test('re-linking your own id is idempotent', async () => {
    const t = testConvex()
    const { player } = await seedBoundGame(t)
    await player.as.mutation(api.bot.linkDiscordId, { discordId: 'discord-player' })
  })
})

describe('rolls are Game history, not a separate store', () => {
  test('a non-member cannot read them', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)
    const outsider = await makeUser(t, 'Outsider')

    await expect(outsider.as.query(api.bot.rolls, { gameId })).rejects.toThrow(/not a member/i)
  })

  test('they live in the Change Log alongside everything else', async () => {
    const t = testConvex()
    const { player } = await seedBoundGame(t)
    await player.as.mutation(api.bot.recordRoll, {
      channelId: 'chan-1',
      discordId: 'discord-player',
      description: 'Heat Check',
      result: { total: 9 },
    })

    // A roll at the table and a roll in the channel are the same kind of fact,
    // so there was no separate "bot events" store to invent.
    const entries = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(entries.some((e) => e.source === 'discord-bot' && e.field === 'roll')).toBe(true)
  })
})
