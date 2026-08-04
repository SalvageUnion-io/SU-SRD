import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../convex/_generated/api'
import { testConvex } from './harness'

/**
 * The Discord bot as a Game participant (Phase 6).
 *
 * The old #165 called for a service-role key and RLS policies — a bot that can
 * act as anybody. These tests exist to prove this one cannot: every path
 * resolves the actor from a *linked* Discord identity that is a *member* of the
 * *bound* Game, and every failure of that chain is reported as a machine-
 * readable reason the bot renders **ephemerally**, because a public channel is
 * the wrong place to announce who has an account.
 *
 * Note what is deliberately absent: there is no `linkDiscordId`. Discord is the
 * sole auth provider, so the snowflake is already in `authAccounts` and is
 * stamped at sign-in. The tests seed `discordId` the way the callback would, or
 * exercise `backfillDiscordIds`, which reads the same source.
 */

type Ctx = ReturnType<typeof testConvex>

/**
 * A user, optionally signed in with Discord.
 *
 * The Discord identity is seeded as an `authAccounts` row — the row
 * `@convex-dev/auth` writes on a real sign-in — because that is what the bot
 * resolves against. Writing `users.discordId` instead would test a field
 * nothing reads.
 */
async function makeUser(t: Ctx, name: string, discordId?: string) {
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('users', { name, displayName: name })
    if (discordId !== undefined) {
      await ctx.db.insert('authAccounts', {
        userId: id,
        provider: 'discord',
        providerAccountId: discordId,
      })
    }
    return id
  })
  return { userId, as: t.withIdentity({ subject: userId }) }
}

async function seedBoundGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer', 'discord-organizer')
  const player = await makeUser(t, 'Player', 'discord-player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await organizer.as.mutation(api.bot.bindChannel, { gameId, channelId: 'chan-1' })
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

  test('the bot obeys the same Organizer rule as the web', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)

    // The bot credential authenticates the BOT, not the ACTOR — a player
    // driving the bot is still only a player.
    const denied = await t.mutation(internal.botClient.bind, {
      discordId: 'discord-player',
      channelId: 'chan-2',
      gameId,
    })
    expect(denied).toMatchObject({ ok: false, reason: 'forbidden' })

    const allowed = await t.mutation(internal.botClient.bind, {
      discordId: 'discord-organizer',
      channelId: 'chan-2',
      gameId,
    })
    expect(allowed).toMatchObject({ ok: true, name: 'Tenacity' })
  })
})

describe('the bot cannot act as anybody', () => {
  test('a linked member roll is recorded, attributed to them', async () => {
    const t = testConvex()
    const { player, gameId } = await seedBoundGame(t)

    const result = await t.mutation(internal.botClient.recordRoll, {
      channelId: 'chan-1',
      discordId: 'discord-player',
      description: 'Heat Check',
      result: { total: 14 },
    })
    expect(result).toMatchObject({ ok: true })

    const rolls = await player.as.query(api.bot.rolls, { gameId })
    expect(rolls).toHaveLength(1)
    expect(rolls[0]?.actorId).toBe(player.userId)
  })

  test('an unlinked Discord id records nothing', async () => {
    const t = testConvex()
    await seedBoundGame(t)

    const result = await t.mutation(internal.botClient.recordRoll, {
      channelId: 'chan-1',
      discordId: 'some-stranger',
      description: 'Heat Check',
      result: {},
    })
    // The bot learns which failure it was so it can explain itself privately;
    // the channel is never told.
    expect(result).toMatchObject({ ok: false, reason: 'unlinked' })
  })

  test('a linked NON-member records nothing', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    await makeUser(t, 'Outsider', 'discord-outsider')

    const result = await t.mutation(internal.botClient.recordRoll, {
      channelId: 'chan-1',
      discordId: 'discord-outsider',
      description: 'Heat Check',
      result: {},
    })
    // Being in the Discord channel is not membership of the Game.
    expect(result).toMatchObject({ ok: false, reason: 'not-a-member' })
  })

  test('an unbound channel records nothing', async () => {
    const t = testConvex()
    await seedBoundGame(t)

    const result = await t.mutation(internal.botClient.recordRoll, {
      channelId: 'chan-nowhere',
      discordId: 'discord-player',
      description: 'Heat Check',
      result: {},
    })
    expect(result).toMatchObject({ ok: false, reason: 'unbound' })
  })

  test('a member of one table cannot read another table’s sheet', async () => {
    const t = testConvex()
    const { organizer } = await seedBoundGame(t)

    // A second Game, bound to a second channel, that the player is not in.
    const otherGame = await organizer.as.mutation(api.games.create, { name: 'Ashfall' })
    await organizer.as.mutation(api.bot.bindChannel, {
      gameId: otherGame,
      channelId: 'chan-other',
    })
    const secretPilot = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: otherGame,
          ownerId: organizer.userId,
          body: { callsign: 'Secret' },
          updatedAt: Date.now(),
        })
    )

    // Holding the id is not enough: it must be in THIS channel's Game, and an
    // id you may not read is reported as absent rather than forbidden.
    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      channelId: 'chan-1',
      table: 'pilots',
      entityId: secretPilot,
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })
})

describe('the Mediator’s prepared opposition stays hidden', () => {
  test('a pilot id cannot be passed as a mech, or vice versa', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedBoundGame(t)
    const pilotId = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          ownerId: organizer.userId,
          body: { callsign: 'Rook' },
          updatedAt: Date.now(),
        })
    )

    // A Convex id is table-tagged, but `db.get` returns a document from ANY
    // table — so a handler that casts the string and checks only `gameId`
    // would happily serve this pilot as a mech.
    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      channelId: 'chan-1',
      table: 'mechs',
      entityId: pilotId,
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })

  test('an encounterNpcs id is not readable through the sheet surface', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)
    const npcId = await t.run(
      async (ctx) => await ctx.db.insert('encounterNpcs', { gameId, body: { name: 'Ambush' } })
    )

    // ADR-030 §5: the Mediator's prepared opposition is the ONE thing a player
    // must not be able to read, and `botHttp.ts` says so in as many words.
    // Same Game, so a gameId-only check would have let this through.
    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      channelId: 'chan-1',
      table: 'pilots',
      entityId: npcId,
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })

  test('a malformed id is not-found rather than a throw', async () => {
    const t = testConvex()
    await seedBoundGame(t)
    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      channelId: 'chan-1',
      table: 'pilots',
      entityId: 'not-an-id',
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })
})

describe('identity comes from the sign-in itself', () => {
  test('a Discord id resolves through the account row Auth.js writes', async () => {
    const t = testConvex()
    await seedBoundGame(t)

    // No stamping, no backfill, no `users.discordId`: `authAccounts` already
    // holds the snowflake, and reading it removes the copy rather than fixing
    // the copier. An earlier attempt stamped it from an
    // `afterUserCreatedOrUpdated` callback, which could never work — the
    // library destructures `id` out of the OAuth profile before any callback
    // sees it, so the value was always undefined and every bot command would
    // have answered "no account" forever.
    const result = await t.query(internal.botClient.me, { discordId: 'discord-player' })
    expect(result).toMatchObject({ ok: true })
  })

  test('a users.discordId column alone resolves nothing', async () => {
    const t = testConvex()
    await t.run(
      async (ctx) => await ctx.db.insert('users', { name: 'Ghost', discordId: 'discord-ghost' })
    )

    // Guards against reintroducing the denormalized column as a second source
    // of truth: it is not where identity lives.
    const result = await t.query(internal.botClient.me, { discordId: 'discord-ghost' })
    expect(result).toMatchObject({ ok: false, reason: 'unlinked' })
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
    await seedBoundGame(t)
    await t.mutation(internal.botClient.recordRoll, {
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

describe('the read surfaces', () => {
  test('me answers for somebody with no account at all', async () => {
    const t = testConvex()
    await seedBoundGame(t)

    const result = await t.query(internal.botClient.me, { discordId: 'nobody' })
    // The whole onboarding surface: there is nothing to link, so the only
    // useful thing to say is "sign in with this same Discord account".
    expect(result).toMatchObject({ ok: false, reason: 'unlinked' })
  })

  test('me lists the games the caller actually belongs to', async () => {
    const t = testConvex()
    await seedBoundGame(t)

    const result = (await t.query(internal.botClient.me, { discordId: 'discord-player' })) as {
      ok: true
      games: Array<{ name: string; organizer: boolean }>
    }
    expect(result.ok).toBe(true)
    expect(result.games).toHaveLength(1)
    expect(result.games[0]).toMatchObject({ name: 'Tenacity', organizer: false })
  })

  test('crew renders an unclaimed entity as a state, not a blank', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          // ADR-030: a null owner is a normal state, and every surface must
          // render it rather than crash or blank.
          ownerId: null,
          body: { callsign: 'Nobody' },
          updatedAt: Date.now(),
        })
    )

    const result = (await t.query(internal.botClient.crew, {
      discordId: 'discord-player',
      channelId: 'chan-1',
    })) as { ok: true; pilots: Array<{ ownerId: string | null; ownerName: string | null }> }
    expect(result.ok).toBe(true)
    expect(result.pilots).toHaveLength(1)
    expect(result.pilots[0]).toMatchObject({ ownerId: null, ownerName: null })
  })

  test('the shelf is personal and needs no binding', async () => {
    const t = testConvex()
    const { player, gameId } = await seedBoundGame(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId: null,
        ownerId: player.userId,
        body: { callsign: 'Shelved' },
        updatedAt: Date.now(),
      })
      // In a Game, so NOT on the shelf.
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: player.userId,
        body: { callsign: 'In play' },
        updatedAt: Date.now(),
      })
    })

    const result = (await t.query(internal.botClient.shelf, {
      discordId: 'discord-player',
    })) as { ok: true; pilots: Array<{ body: { callsign: string } }> }
    expect(result.pilots).toHaveLength(1)
    expect(result.pilots[0]?.body.callsign).toBe('Shelved')
  })

  test('channel reports the roster and the Downtime phase', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedBoundGame(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    await organizer.as.mutation(api.downtime.begin, { gameId })

    const result = (await t.query(internal.botClient.channel, {
      discordId: 'discord-player',
      channelId: 'chan-1',
    })) as {
      ok: true
      game: { name: string }
      members: Array<{ mediator: boolean }>
      downtime: { running: boolean }
    }
    expect(result.game.name).toBe('Tenacity')
    expect(result.members).toHaveLength(2)
    expect(result.downtime.running).toBe(true)
  })
})
