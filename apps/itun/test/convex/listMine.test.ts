/**
 * `entities.listMine` — the read that makes "IndexedDB is a cache" true.
 *
 * Until this existed, writes mirrored up and nothing outside a Game read back
 * down, so a signed-in player on a second device saw an empty roster while
 * their builds sat in Convex. These tests pin the two things that were easy to
 * get wrong: it returns what you own **wherever it lives**, and it returns
 * nothing that is not yours.
 */

import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { testConvex } from './harness'

async function makeUser(t: ReturnType<typeof testConvex>, name: string) {
  const userId = await t.run(async (ctx) => await ctx.db.insert('users', { name }))
  return { userId, as: t.withIdentity({ subject: userId }) }
}

describe('listMine returns what the caller owns', () => {
  test('a shelved pilot comes back', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: me.userId,
          body: { callsign: 'Roach-Boy' },
          updatedAt: 1,
        })
    )

    const mine = await me.as.query(api.entities.listMine, {})
    expect(mine.pilots).toHaveLength(1)
  })

  test('a pilot you own INSIDE a game comes back too', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const gameId = await t.run(async (ctx) => await ctx.db.insert('games', { name: 'Table' }))
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          ownerId: me.userId,
          body: { callsign: 'In play' },
          updatedAt: 1,
        })
    )

    // Scoping this to the shelf would make a build vanish from the local cache
    // the moment it was taken into a campaign, and reappear when the campaign
    // ended. It is still yours either way.
    const mine = await me.as.query(api.entities.listMine, {})
    expect(mine.pilots).toHaveLength(1)
  })

  test('the crawler comes back — only possible since #871 gave it an owner', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId: null,
          ownerId: me.userId,
          body: { name: '#430' },
          updatedAt: 1,
        })
    )

    const mine = await me.as.query(api.entities.listMine, {})
    expect(mine.crawlers).toHaveLength(1)
  })
})

describe("listMine returns nothing that is not the caller's", () => {
  test("another player's pilot is not returned", async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const them = await makeUser(t, 'Them')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: them.userId,
          body: { callsign: 'Not yours' },
          updatedAt: 1,
        })
    )

    const mine = await me.as.query(api.entities.listMine, {})
    expect(mine.pilots).toEqual([])
  })

  test('an UNCLAIMED pilot in a game is not returned', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const gameId = await t.run(async (ctx) => await ctx.db.insert('games', { name: 'Table' }))
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          ownerId: null,
          body: { callsign: 'Pre-gen' },
          updatedAt: 1,
        })
    )

    // Excluded by construction — no `ownerId` means the index cannot return it
    // — and that is the right answer rather than a lucky one: an unclaimed
    // pre-gen belongs to the Game's view, not to anybody's roster.
    const mine = await me.as.query(api.entities.listMine, {})
    expect(mine.pilots).toEqual([])
  })

  test('it refuses a caller with no account at all', async () => {
    const t = testConvex()
    await expect(t.query(api.entities.listMine, {})).rejects.toThrow(/signed in/i)
  })
})
