import { describe, expect, test } from 'bun:test'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { testConvex } from './harness'

/**
 * Account management, and in particular the promise D27 makes:
 * **a campaign never dies because one person quit.**
 *
 * Deletion is the operation with no undo, so the cases below are less about
 * "does it delete" and more about "does it delete *only* the right things" —
 * the crew's Game, the communal crawler, and other people's characters all
 * have to survive somebody exercising their right to be forgotten.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

async function seedPilot(t: Ctx, gameId: Id<'games'> | null, ownerId: Id<'users'> | null) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert('pilots', { gameId, ownerId, body: { callsign: 'X' }, updatedAt: 1 })
  )
}

describe('profile', () => {
  test('displayName falls back to the Discord name when unset', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Roach-Boy')
    await u.as.mutation(api.account.updateProfile, { displayName: null })

    const me = await u.as.query(api.account.me, {})
    // Cleared means "fall back", not "blank" — a nameless owner chip is worse
    // than a stale one.
    expect(me?.displayName).toBe('Roach-Boy')
  })

  test('a set displayName overrides the Discord name', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Roach-Boy')
    await u.as.mutation(api.account.updateProfile, { displayName: '  Beefcake  ' })

    const me = await u.as.query(api.account.me, {})
    expect(me?.displayName).toBe('Beefcake')
  })

  test('an anonymous caller has no profile to read', async () => {
    const t = testConvex()
    await expect(t.query(api.account.me, {})).rejects.toThrow(/not signed in/i)
  })
})

describe('export is scoped to what you own', () => {
  test('excludes a crewmate pilot you can merely see', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const other = await makeUser(t, 'Other')
    const gameId = await owner.as.mutation(api.games.create, { name: 'Tenacity' })
    const code = await owner.as.mutation(api.invites.create, { gameId })
    await other.as.mutation(api.invites.redeem, { code })

    await seedPilot(t, gameId, owner.userId)
    await seedPilot(t, gameId, other.userId)

    const mine = await owner.as.query(api.account.exportMine, {})
    // Readable inside a Game is not the same as yours to take away.
    expect(mine.pilots).toHaveLength(1)
  })
})

describe('deleteAccount — the campaign survives', () => {
  test('Organizer passes to the longest-standing remaining member', async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const early = await makeUser(t, 'Early')
    const late = await makeUser(t, 'Late')

    const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await early.as.mutation(api.invites.redeem, { code })
    await late.as.mutation(api.invites.redeem, { code })

    // Make the ordering unambiguous rather than relying on clock resolution.
    await t.run(async (ctx) => {
      for (const m of await ctx.db.query('memberships').collect()) {
        if (m.userId === early.userId) await ctx.db.patch(m._id, { joinedAt: 100 })
        if (m.userId === late.userId) await ctx.db.patch(m._id, { joinedAt: 200 })
      }
    })

    await organizer.as.mutation(api.account.deleteAccount, {})

    const roster = await early.as.query(api.games.members, { gameId })
    const organizers = roster.filter((m) => m.organizer)
    expect(organizers).toHaveLength(1)
    expect(organizers[0]?.userId).toBe(early.userId)
  })

  test('the Game and the communal crawler survive', async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const player = await makeUser(t, 'Player')
    const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await player.as.mutation(api.invites.redeem, { code })

    const crawlerId = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', { gameId, body: { name: '#430' }, updatedAt: 1 })
    )

    await organizer.as.mutation(api.account.deleteAccount, {})

    const game = await t.run(async (ctx) => await ctx.db.get(gameId))
    const crawler = await t.run(async (ctx) => await ctx.db.get(crawlerId))
    expect(game).not.toBeNull()
    // The crawler belongs to the table, not to whoever set the Game up.
    expect(crawler).not.toBeNull()
  })

  test("another member's pilot is untouched", async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const player = await makeUser(t, 'Player')
    const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await player.as.mutation(api.invites.redeem, { code })

    const theirs = await seedPilot(t, gameId, player.userId)
    await organizer.as.mutation(api.account.deleteAccount, {})

    const pilot = await t.run(async (ctx) => await ctx.db.get(theirs))
    expect(pilot).not.toBeNull()
    expect(pilot?.ownerId).toBe(player.userId)
  })

  test('the departing account’s own entities go, in a Game and on the shelf alike', async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const player = await makeUser(t, 'Player')
    const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await player.as.mutation(api.invites.redeem, { code })

    const inGame = await seedPilot(t, gameId, organizer.userId)
    const onShelf = await seedPilot(t, null, organizer.userId)

    await organizer.as.mutation(api.account.deleteAccount, {})

    expect(await t.run(async (ctx) => await ctx.db.get(inGame))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get(onShelf))).toBeNull()
  })

  test('the last member out takes the Game with them', async () => {
    const t = testConvex()
    const solo = await makeUser(t, 'Solo')
    const gameId = await solo.as.mutation(api.games.create, { name: 'Alone' })
    const crawlerId = await t.run(
      async (ctx) => await ctx.db.insert('crawlers', { gameId, body: {}, updatedAt: 1 })
    )
    const unclaimed = await seedPilot(t, gameId, null)

    await solo.as.mutation(api.account.deleteAccount, {})

    // An empty Game is not a campaign anybody can come back to, and its
    // unclaimed entities have no shelf to fall back to.
    expect(await t.run(async (ctx) => await ctx.db.get(gameId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get(crawlerId))).toBeNull()
    expect(await t.run(async (ctx) => await ctx.db.get(unclaimed))).toBeNull()
  })

  test('the user row and its auth rows are gone', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Gone')

    // A session with a refresh token hanging off it — the ordering hazard.
    await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert('authSessions', {
        userId: u.userId,
        expirationTime: Date.now() + 1000,
      })
      await ctx.db.insert('authRefreshTokens', {
        sessionId,
        expirationTime: Date.now() + 1000,
      })
      await ctx.db.insert('authAccounts', {
        userId: u.userId,
        provider: 'discord',
        providerAccountId: 'abc123',
      })
    })

    await u.as.mutation(api.account.deleteAccount, {})

    const left = await t.run(async (ctx) => ({
      user: await ctx.db.get(u.userId),
      sessions: (await ctx.db.query('authSessions').collect()).length,
      tokens: (await ctx.db.query('authRefreshTokens').collect()).length,
      accounts: (await ctx.db.query('authAccounts').collect()).length,
    }))

    expect(left.user).toBeNull()
    expect(left.sessions).toBe(0)
    // Refresh tokens are keyed by session, not user — they are the rows most
    // likely to be left behind pointing at something deleted.
    expect(left.tokens).toBe(0)
    expect(left.accounts).toBe(0)
  })
})
