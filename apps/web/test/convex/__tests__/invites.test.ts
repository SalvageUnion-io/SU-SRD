import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { refreshGameSummary } from '../../../convex/model/entities'
import type { Ctx } from '../fixtures'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * A Game's invite URL (ADR-030's invite amendment): one per Game. Anyone
 * signed in who opens it joins as a player; the Organizer copies it and can
 * reset it, and a reset code opens nothing.
 */

async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  return { organizer, gameId }
}

async function seedPilot(t: Ctx, gameId: Id<'games'>, ownerId: Id<'users'> | null) {
  return await t.run(async (ctx) =>
    ctx.db.insert('pilots', {
      gameId,
      ownerId,
      body: { callsign: 'Roach-Boy' },
      updatedAt: Date.now(),
    })
  )
}

/** An invite row as an older door minted it, straight into the table. */
async function seedLegacyInvite(
  t: Ctx,
  gameId: Id<'games'>,
  createdBy: Id<'users'>,
  code: string,
  extra: {
    standing?: boolean
    requiresApproval?: boolean
    target?: { kind: 'discord'; discordId: string }
  }
) {
  await t.run(async (ctx) => {
    const now = Date.now()
    await ctx.db.insert('invites', {
      gameId,
      code,
      createdBy,
      createdAt: now,
      expiresAt: now + 1000 * 60 * 60 * 24 * 7,
      role: 'player',
      requiresApproval: extra.requiresApproval ?? false,
      standing: extra.standing,
      target: extra.target,
    })
  })
}

describe('the invite URL', () => {
  test('is sixteen Crockford characters, and copying again hands out the same one', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const code = await organizer.as.mutation(api.invites.link, { gameId })
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/)
    expect(await organizer.as.mutation(api.invites.link, { gameId })).toBe(code)
  })

  test('opening it joins as a player, however many people use it', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const code = await organizer.as.mutation(api.invites.link, { gameId })

    for (const name of ['Ash', 'Bex', 'Cole']) {
      const joiner = await makeUser(t, name)
      expect(await joiner.as.mutation(api.invites.redeem, { code })).toEqual({
        kind: 'joined',
        gameId,
      })
      const membership = await t.run(async (ctx) =>
        ctx.db
          .query('memberships')
          .withIndex('by_game_user', (q) => q.eq('gameId', gameId).eq('userId', joiner.userId))
          .unique()
      )
      expect(membership).toMatchObject({ mediator: false, organizer: false })
    }
  })

  test('opening it twice is a no-op, not an error', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Sam')
    const code = await organizer.as.mutation(api.invites.link, { gameId })
    await joiner.as.mutation(api.invites.redeem, { code })
    expect((await joiner.as.mutation(api.invites.redeem, { code })).kind).toBe('already')
    expect(await joiner.as.query(api.games.listMine, {})).toHaveLength(1)
  })

  test('is the Organizer’s alone to copy or reset', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const player = await makeUser(t, 'Player')
    const stranger = await makeUser(t, 'Stranger')
    await player.as.mutation(api.invites.redeem, {
      code: await organizer.as.mutation(api.invites.link, { gameId }),
    })

    await expect(player.as.mutation(api.invites.link, { gameId })).rejects.toThrow()
    await expect(player.as.mutation(api.invites.reset, { gameId })).rejects.toThrow()
    await expect(stranger.as.mutation(api.invites.link, { gameId })).rejects.toThrow(
      /not a member/i
    )
  })
})

describe('resetting it', () => {
  test('mints a new URL; the old one stops working but evicts nobody', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const early = await makeUser(t, 'Early')
    const late = await makeUser(t, 'Late')
    const old = await organizer.as.mutation(api.invites.link, { gameId })
    await early.as.mutation(api.invites.redeem, { code: old })

    const fresh = await organizer.as.mutation(api.invites.reset, { gameId })
    expect(fresh).not.toBe(old)
    expect(await organizer.as.mutation(api.invites.link, { gameId })).toBe(fresh)

    await expect(late.as.mutation(api.invites.redeem, { code: old })).rejects.toThrow(
      /no longer works/i
    )
    expect(await late.as.query(api.invites.preview, { code: old })).toBeNull()
    // Someone already seated still lands in the Game from the old link.
    expect((await early.as.mutation(api.invites.redeem, { code: old })).kind).toBe('already')

    expect((await late.as.mutation(api.invites.redeem, { code: fresh })).kind).toBe('joined')
  })
})

describe('codes from retired invite kinds', () => {
  test('the newest open standing link keeps working; every other code opens nothing', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    await seedLegacyInvite(t, gameId, organizer.userId, 'OLDSTANDING00000', { standing: true })
    await seedLegacyInvite(t, gameId, organizer.userId, 'NEWSTANDING00000', { standing: true })
    await seedLegacyInvite(t, gameId, organizer.userId, 'MINTEDBYCREATE00', {})
    await seedLegacyInvite(t, gameId, organizer.userId, 'APPROVALLINK0000', {
      standing: true,
      requiresApproval: true,
    })
    await seedLegacyInvite(t, gameId, organizer.userId, 'ADDRESSEDTOSAM00', {
      target: { kind: 'discord', discordId: 'snowflake-sam' },
    })

    // An already-shared link keeps working, and is what "Copy invite link" hands out.
    expect(await organizer.as.mutation(api.invites.link, { gameId })).toBe('NEWSTANDING00000')
    const joiner = await makeUser(t, 'Joiner')
    expect((await joiner.as.mutation(api.invites.redeem, { code: 'newstanding00000' })).kind).toBe(
      'joined'
    )

    for (const code of [
      'OLDSTANDING00000',
      'MINTEDBYCREATE00',
      'APPROVALLINK0000',
      'ADDRESSEDTOSAM00',
    ]) {
      const someone = await makeUser(
        t,
        `Someone ${code}`,
        code === 'ADDRESSEDTOSAM00' ? 'snowflake-sam' : undefined
      )
      expect(await someone.as.query(api.invites.preview, { code })).toBeNull()
      await expect(someone.as.mutation(api.invites.redeem, { code })).rejects.toThrow(
        /no longer works/i
      )
    }
  })
})

describe('preview', () => {
  test('describes the Game without spending the code or leaking the crew', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const stranger = await makeUser(t, 'Stranger')
    const code = await organizer.as.mutation(api.invites.link, { gameId })

    expect(await stranger.as.query(api.invites.preview, { code })).toEqual({
      gameName: 'Tenacity',
      invitedBy: 'Organizer',
    })
    // Looking is not joining.
    expect(await stranger.as.query(api.games.listMine, {})).toHaveLength(0)
  })

  test('an unknown code is null rather than an error', async () => {
    const t = testConvex()
    const stranger = await makeUser(t, 'Stranger')
    expect(await stranger.as.query(api.invites.preview, { code: 'ZZZZZZZZ' })).toBeNull()
    await expect(stranger.as.mutation(api.invites.redeem, { code: 'ZZZZZZZZ' })).rejects.toThrow(
      /not valid/i
    )
  })
})

describe('deleting a game', () => {
  test('sweeps its invites, and any redemptions and asks older doors left', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Sam')
    const code = await organizer.as.mutation(api.invites.link, { gameId })
    await joiner.as.mutation(api.invites.redeem, { code })
    await t.run(async (ctx) => {
      const invite = await ctx.db.query('invites').first()
      if (invite === null) throw new Error('expected an invite')
      await ctx.db.insert('inviteRedemptions', {
        inviteId: invite._id,
        gameId,
        userId: joiner.userId,
        redeemedAt: Date.now(),
      })
      await ctx.db.insert('joinRequests', {
        gameId,
        inviteId: invite._id,
        userId: joiner.userId,
        requestedAt: Date.now(),
        state: 'pending',
      })
    })

    await organizer.as.mutation(api.games.destroy, { gameId })

    const leftovers = await t.run(async (ctx) => ({
      invites: (await ctx.db.query('invites').collect()).length,
      redemptions: (await ctx.db.query('inviteRedemptions').collect()).length,
      requests: (await ctx.db.query('joinRequests').collect()).length,
    }))
    expect(leftovers).toEqual({ invites: 0, redemptions: 0, requests: 0 })
  })
})

describe('games.get and the row summary', () => {
  test('summarize carries the crawler name and the entity counts', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    await seedPilot(t, gameId, null)
    await seedPilot(t, gameId, null)
    await t.run(async (ctx) => {
      await ctx.db.insert('mechs', {
        gameId,
        ownerId: null,
        body: { name: 'Mule' },
        updatedAt: Date.now(),
      })
      await ctx.db.insert('crawlers', {
        gameId,
        ownerId: null,
        body: { name: 'Hamlet' },
        updatedAt: Date.now(),
      })
    })
    // Compacts written straight to a table bypass the triggers that keep
    // `games.summary` current, so recount it as a roster mutation would.
    await t.run(async (ctx) => {
      await refreshGameSummary(ctx, gameId)
    })

    const game = await organizer.as.query(api.games.get, { gameId })
    expect(game).toMatchObject({
      crawlerName: 'Hamlet',
      pilotCount: 2,
      mechCount: 1,
    })
  })

  test('a game with no crawler and nothing built degrades rather than breaking', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const game = await organizer.as.query(api.games.get, { gameId })
    // The badges need a null to render "No crawler", not an undefined to crash on.
    expect(game).toMatchObject({ crawlerName: null, pilotCount: 0, mechCount: 0 })
  })

  test('games.get is null for a non-member rather than an error', async () => {
    const t = testConvex()
    const { gameId } = await seedGame(t)
    const stranger = await makeUser(t, 'Stranger')
    // A bookmarked URL for a game you left is an ordinary thing to visit.
    expect(await stranger.as.query(api.games.get, { gameId })).toBeNull()
  })
})

describe('dropRetired', () => {
  test('reports without changing anything, then clears the retired columns and rows', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const code = await organizer.as.mutation(api.invites.link, { gameId })
    await seedLegacyInvite(t, gameId, organizer.userId, 'OLDCODE1', { requiresApproval: true })
    const joiner = await makeUser(t, 'Ash')
    await t.run(async (ctx) => {
      const legacy = await ctx.db
        .query('invites')
        .withIndex('by_code', (q) => q.eq('code', 'OLDCODE1'))
        .unique()
      if (legacy === null) throw new Error('no legacy invite')
      await ctx.db.insert('joinRequests', {
        gameId,
        inviteId: legacy._id,
        userId: joiner.userId,
        requestedAt: Date.now(),
        state: 'pending',
      })
      await ctx.db.insert('inviteRedemptions', {
        gameId,
        inviteId: legacy._id,
        userId: joiner.userId,
        redeemedAt: Date.now(),
      })
      await ctx.db.insert('channelBindings', {
        gameId,
        channelId: 'chan-1',
        boundBy: organizer.userId,
        boundAt: Date.now(),
      })
    })

    const counts = { invites: 1, joinRequests: 1, inviteRedemptions: 1 }
    expect(await t.mutation(internal.invites.dropRetired, {})).toEqual(counts)
    expect(await t.mutation(internal.invites.dropRetired, {})).toEqual(counts)

    expect(await t.mutation(internal.invites.dropRetired, { apply: true })).toEqual(counts)
    expect(await t.mutation(internal.invites.dropRetired, {})).toEqual({
      invites: 0,
      joinRequests: 0,
      inviteRedemptions: 0,
    })
    // A channel binding is live again (`/su bind`): the repair leaves it alone.
    const bindings = await t.run(async (ctx) => ctx.db.query('channelBindings').collect())
    expect(bindings.map((row) => row.channelId)).toEqual(['chan-1'])
    const legacy = await t.run(async (ctx) =>
      ctx.db
        .query('invites')
        .withIndex('by_code', (q) => q.eq('code', 'OLDCODE1'))
        .unique()
    )
    expect(legacy?.requiresApproval).toBeUndefined()
    expect(legacy?.expiresAt).toBeUndefined()
    expect(legacy?.role).toBeUndefined()
    // The live link still opens.
    expect(await joiner.as.mutation(api.invites.redeem, { code })).toEqual({
      kind: 'joined',
      gameId,
    })
  })
})
