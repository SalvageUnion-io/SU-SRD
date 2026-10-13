import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../../convex/_generated/api'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * The Discord bot as a Game participant.
 *
 * The bot holds no service-role key: it cannot act as anybody. These tests
 * prove it: every path
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

async function seedBoundGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer', 'discord-organizer')
  const player = await makeUser(t, 'Player', 'discord-player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await t.mutation(internal.botClient.bind, {
    discordId: 'discord-organizer',
    channelId: 'chan-1',
    gameId,
  })
  return { organizer, player, gameId }
}

describe('channel binding', () => {
  test('one game per channel', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedBoundGame(t)
    const other = await organizer.as.mutation(api.games.create, { name: 'Other' })

    // A channel meaning two games makes every roll in it ambiguous, and the
    // bot has no way to ask which was meant.
    const clash = await t.mutation(internal.botClient.bind, {
      discordId: 'discord-organizer',
      channelId: 'chan-1',
      gameId: other,
    })
    expect(clash).toMatchObject({ ok: false })

    // The rejected bind leaves the original one standing.
    const still = await t.query(internal.botClient.channel, {
      discordId: 'discord-organizer',
      channelId: 'chan-1',
    })
    expect(still).toMatchObject({ ok: true, game: { gameId } })

    // Re-binding the same pair is a no-op, not an error.
    const same = await t.mutation(internal.botClient.bind, {
      discordId: 'discord-organizer',
      channelId: 'chan-1',
      gameId,
    })
    expect(same).toMatchObject({ ok: true })
  })

  test('only the Organizer may unbind', async () => {
    const t = testConvex()
    await seedBoundGame(t)

    const denied = await t.mutation(internal.botClient.unbind, {
      discordId: 'discord-player',
      channelId: 'chan-1',
    })
    expect(denied).toMatchObject({ ok: false, reason: 'forbidden' })

    const allowed = await t.mutation(internal.botClient.unbind, {
      discordId: 'discord-organizer',
      channelId: 'chan-1',
    })
    expect(allowed).toMatchObject({ ok: true })
  })

  test('resolves the game a channel speaks for', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)
    const found = await t.query(internal.botClient.channel, {
      discordId: 'discord-player',
      channelId: 'chan-1',
    })
    expect(found).toMatchObject({ ok: true, game: { gameId } })
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

    // Read the Change Log directly: a roll IS a Change Log entry, and there is
    // no web-facing bot query to read it through.
    const rolls = await t.run(async (ctx) =>
      (await ctx.db.query('changeLog').collect()).filter((e) => e.field === 'roll')
    )
    expect(rolls).toHaveLength(1)
    expect(rolls[0]?.actorId).toBe(player.userId)
    expect(rolls[0]?.gameId).toBe(gameId)
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
    await t.mutation(internal.botClient.bind, {
      discordId: 'discord-organizer',
      channelId: 'chan-other',
      gameId: otherGame,
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

    // Holding the id is not enough: it must be yours, in a Game you belong to,
    // or published, and an id you may not read is reported as absent rather
    // than forbidden.
    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
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
      table: 'mechs',
      entityId: pilotId,
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })

  test('an encounterNpcs id is not readable through the sheet surface', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)
    const npcId = await t.run(
      async (ctx) =>
        await ctx.db.insert('encounterNpcs', {
          gameId,
          ownerId: null,
          appId: 'npc-1',
          body: { id: 'npc-1', name: 'Ambush' },
        })
    )

    // ADR-030 §5: the Mediator's prepared opposition is the ONE thing a player
    // must not be able to read, and `botHttp.ts` says so in as many words.
    // Same Game, so a gameId-only check would have let this through.
    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
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
      table: 'pilots',
      entityId: 'not-an-id',
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })

  test('widening to crawlers did not open a path to the NPC tray', async () => {
    // `crawlers` joined the table union so the communal crawler could be
    // opened. `normalizeId` is what keeps that from being a hole: an
    // encounterNpcs row lives in the same Game, so a gameId-only check would
    // now serve it as a crawler.
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)
    const npcId = await t.run(
      async (ctx) =>
        await ctx.db.insert('encounterNpcs', {
          gameId,
          ownerId: null,
          appId: 'npc-1',
          body: { id: 'npc-1', name: 'Ambush' },
        })
    )

    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      table: 'crawlers',
      entityId: npcId,
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })
})

describe('/su sheet reaches beyond one channel', () => {
  test('your own shelved pilot opens anywhere, by row id or app id', async () => {
    const t = testConvex()
    const { player } = await seedBoundGame(t)
    const pilotId = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: player.userId,
          appId: 'pilot-app-1',
          body: { callsign: 'Shelved' },
          updatedAt: Date.now(),
        })
    )

    for (const entityId of [pilotId, 'pilot-app-1']) {
      const result = await t.query(internal.botClient.sheet, {
        discordId: 'discord-player',
        table: 'pilots',
        entityId,
      })
      expect(result).toMatchObject({ ok: true, id: pilotId, ownerName: 'Player' })
    }
  })

  test('a published sheet opens for anybody, account or not', async () => {
    const t = testConvex()
    const { organizer } = await seedBoundGame(t)
    await t.run(
      async (ctx) =>
        await ctx.db.insert('mechs', {
          gameId: null,
          ownerId: organizer.userId,
          appId: 'mech-public',
          publicRead: true,
          body: { name: 'Lantern' },
          updatedAt: Date.now(),
        })
    )

    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-nobody',
      table: 'mechs',
      entityId: 'mech-public',
    })
    expect(result).toMatchObject({ ok: true, publicRead: true, body: { name: 'Lantern' } })
  })

  test('a private stranger sheet is not-found, or unlinked without an account', async () => {
    const t = testConvex()
    const { organizer } = await seedBoundGame(t)
    const mechId = await t.run(
      async (ctx) =>
        await ctx.db.insert('mechs', {
          gameId: null,
          ownerId: organizer.userId,
          body: { name: 'Private' },
          updatedAt: Date.now(),
        })
    )

    const stranger = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      table: 'mechs',
      entityId: mechId,
    })
    expect(stranger).toMatchObject({ ok: false, reason: 'not-found' })
    const nobody = await t.query(internal.botClient.sheet, {
      discordId: 'discord-nobody',
      table: 'mechs',
      entityId: mechId,
    })
    expect(nobody).toMatchObject({ ok: false, reason: 'unlinked' })
  })

  test('mine lists what you own and the crawler of each Game you are in', async () => {
    const t = testConvex()
    const { player, organizer, gameId } = await seedBoundGame(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId: null,
        ownerId: player.userId,
        body: { callsign: 'Shelved' },
        updatedAt: Date.now(),
      })
      await ctx.db.insert('mechs', {
        gameId,
        ownerId: player.userId,
        body: { name: 'In play' },
        updatedAt: Date.now(),
      })
      // Somebody else's: not offered.
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: organizer.userId,
        body: { callsign: 'Theirs' },
        updatedAt: Date.now(),
      })
      await ctx.db.insert('crawlers', {
        gameId,
        ownerId: null,
        body: { name: 'The Ossuary' },
        updatedAt: Date.now(),
      })
    })

    const result = await t.query(internal.botClient.mine, { discordId: 'discord-player' })
    if (!result.ok) throw new Error(`mine denied: ${result.reason}`)
    expect(result.pilots.map((p) => p.body.callsign)).toEqual(['Shelved'])
    expect(result.mechs.map((m) => m.body.name)).toEqual(['In play'])
    expect(result.crawlers.map((c) => c.body.name)).toEqual(['The Ossuary'])

    const unlinked = await t.query(internal.botClient.mine, { discordId: 'discord-nobody' })
    expect(unlinked).toMatchObject({ ok: false, reason: 'unlinked' })
  })
})

describe('the communal crawler is readable', () => {
  test('a member may open the crawler, which has no owner at all', async () => {
    const t = testConvex()
    const { gameId } = await seedBoundGame(t)
    const crawlerId = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          ownerId: null,
          body: { name: 'The Ossuary', techLevel: '3' },
          updatedAt: Date.now(),
        })
    )

    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      table: 'crawlers',
      entityId: crawlerId,
    })

    // `ownerName: null` is the crawler being communal (ADR-030 §5), not an
    // owner lookup that failed. The table has no `ownerId` column to read.
    expect(result).toMatchObject({
      ok: true,
      table: 'crawlers',
      ownerName: null,
      body: { name: 'The Ossuary' },
    })
  })

  test('a crawler belonging to another table is not-found', async () => {
    const t = testConvex()
    const { organizer } = await seedBoundGame(t)

    // A second Game the player is NOT in: membership of one Game must not
    // open another's crawler.
    const otherGameId = await organizer.as.mutation(api.games.create, { name: 'Elsewhere' })
    const foreign = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId: otherGameId,
          ownerId: null,
          body: { name: 'Not Yours' },
          updatedAt: Date.now(),
        })
    )

    const result = await t.query(internal.botClient.sheet, {
      discordId: 'discord-player',
      table: 'crawlers',
      entityId: foreign,
    })
    expect(result).toMatchObject({ ok: false, reason: 'not-found' })
  })
})

describe('identity comes from the sign-in itself', () => {
  test('a Discord id resolves through the account row Auth.js writes', async () => {
    const t = testConvex()
    await seedBoundGame(t)

    // `authAccounts` holds the snowflake; nothing copies it onto `users`.
    const result = await t.query(internal.botClient.me, { discordId: 'discord-player' })
    expect(result).toMatchObject({ ok: true })
  })
})

/**
 * There is no public reader of roll history, so no "a non-member cannot read
 * them" case: there is no surface for an outsider to be refused *from*, and the
 * assertion would be vacuous rather than reassuring. Membership gating on what the bot itself can read is covered above, against
 * `botClient`, which is the path that actually runs.
 */
describe('rolls are Game history, not a separate store', () => {
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

    const result = await t.query(internal.botClient.me, { discordId: 'discord-player' })
    if (!result.ok) throw new Error(`me denied: ${result.reason}`)
    expect(result.games).toHaveLength(1)
    expect(result.games[0]).toMatchObject({ name: 'Tenacity', organizer: false })
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

    const result = await t.query(internal.botClient.channel, {
      discordId: 'discord-player',
      channelId: 'chan-1',
    })
    if (!result.ok) throw new Error(`channel denied: ${result.reason}`)
    expect(result.game.name).toBe('Tenacity')
    expect(result.members).toHaveLength(2)
    expect(result.downtime.running).toBe(true)
  })
})
