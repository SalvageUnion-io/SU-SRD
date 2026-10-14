import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../../convex/_generated/api'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * The Discord bot as a Game participant.
 *
 * The bot holds no service-role key: it cannot act as anybody. These tests
 * prove it: every path resolves the actor from a *linked* Discord identity and
 * reads only what that account may read, and every refusal is reported as a
 * machine-readable reason the bot renders **ephemerally**, because a public
 * channel is the wrong place to announce who has an account.
 *
 * Note what is deliberately absent: there is no `linkDiscordId`. Discord is the
 * sole auth provider, so the snowflake is already in `authAccounts` and is
 * stamped at sign-in. The tests seed `discordId` the way the callback would, or
 * exercise `backfillDiscordIds`, which reads the same source.
 */

async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer', 'discord-organizer')
  const player = await makeUser(t, 'Player', 'discord-player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.link, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  return { organizer, player, gameId }
}

describe('the bot cannot act as anybody', () => {
  test('a member of one table cannot read another table’s sheet', async () => {
    const t = testConvex()
    const { organizer } = await seedGame(t)

    // A second Game that the player is not in.
    const otherGame = await organizer.as.mutation(api.games.create, { name: 'Ashfall' })
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
    const { organizer, gameId } = await seedGame(t)
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
    const { gameId } = await seedGame(t)
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
    await seedGame(t)
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
    const { gameId } = await seedGame(t)
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
    const { player } = await seedGame(t)
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
    const { organizer } = await seedGame(t)
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
    const { organizer } = await seedGame(t)
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
    const { player, organizer, gameId } = await seedGame(t)
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
    const { gameId } = await seedGame(t)
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
    const { organizer } = await seedGame(t)

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
    await seedGame(t)

    // `authAccounts` holds the snowflake; nothing copies it onto `users`.
    const result = await t.query(internal.botClient.me, { discordId: 'discord-player' })
    expect(result).toMatchObject({ ok: true })
  })
})

describe('the read surfaces', () => {
  test('me answers for somebody with no account at all', async () => {
    const t = testConvex()
    await seedGame(t)

    const result = await t.query(internal.botClient.me, { discordId: 'nobody' })
    // The whole onboarding surface: there is nothing to link, so the only
    // useful thing to say is "sign in with this same Discord account".
    expect(result).toMatchObject({ ok: false, reason: 'unlinked' })
  })

  test('me lists the games the caller actually belongs to', async () => {
    const t = testConvex()
    await seedGame(t)

    const result = await t.query(internal.botClient.me, { discordId: 'discord-player' })
    if (!result.ok) throw new Error(`me denied: ${result.reason}`)
    expect(result.games).toHaveLength(1)
    expect(result.games[0]).toMatchObject({ name: 'Tenacity', organizer: false })
  })
})
