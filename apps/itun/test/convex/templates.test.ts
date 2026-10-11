import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { makeUser } from './fixtures'
import { testConvex } from './harness'

/**
 * Game templates (ADR-030).
 *
 * The property under test is the one that makes a template useful rather than
 * decorative: **its entities arrive unclaimed**, so the person running the
 * table hands them out. A template that pre-assigned everything to its creator
 * would just be a private roster with extra steps.
 */

describe('starter-set template', () => {
  test('is listed', async () => {
    const t = testConvex()
    const templates = await t.query(api.templates.list, {})
    expect(templates.map((x) => x.id)).toContain('starter-set')
  })

  test('every pilot and mech arrives unclaimed', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const { pilots, mechs } = await t.run(async (ctx) => ({
      pilots: await ctx.db.query('pilots').collect(),
      mechs: await ctx.db.query('mechs').collect(),
    }))

    expect(pilots.length).toBeGreaterThan(0)
    expect(mechs.length).toBeGreaterThan(0)
    // Not owned by the creator — that is the difference between a template and
    // a private roster.
    expect(pilots.every((p) => p.ownerId === null)).toBe(true)
    expect(mechs.every((m) => m.ownerId === null)).toBe(true)
  })

  test('the creator is Organizer and a seated Player, as with any game', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const gameId = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const roster = await u.as.query(api.games.members, { gameId })
    expect(roster).toHaveLength(1)
    expect(roster[0]?.organizer).toBe(true)
    // A template changes what is IN the game, never who runs it.
    expect(roster[0]?.mediator).toBe(false)
  })

  test('the crawler is created communally — in a game, it belongs to nobody', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const crawlers = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(crawlers.length).toBeGreaterThan(0)
    // Communal is now expressed as `ownerId: null` on a row that HAS the column,
    // rather than by the column's absence. This test used to assert the absence
    // (`not.toHaveProperty('ownerId')`), which stopped meaning anything the
    // moment a crawler could also sit on a shelf — where it must have an owner.
    // What matters is unchanged and is what is asserted now: inside a Game, the
    // crawler is the crew's and is handed to no one.
    expect(crawlers[0]?.ownerId).toBeNull()
    expect(crawlers[0]?.gameId).not.toBeNull()
  })

  test('soft links come across, so the crew is wired together on arrival', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    // Without these the pilots and mechs would arrive as unrelated strangers.
    expect(links.length).toBeGreaterThan(0)
    expect(links.some((l) => l.type === 'mech-to-pilot')).toBe(true)
  })

  test('the game records which template it came from', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const gameId = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const game = await t.run(async (ctx) => await ctx.db.get(gameId))
    expect(game?.templateOrigin).toBe('starter-set')
  })

  test('a custom name overrides the template name', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const gameId = await u.as.mutation(api.templates.createGame, {
      templateId: 'starter-set',
      name: '  Our Tuesday Game  ',
    })

    const game = await t.run(async (ctx) => await ctx.db.get(gameId))
    expect(game?.name).toBe('Our Tuesday Game')
  })

  test('a claimed pre-gen comes down in its Game, not on the shelf', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const gameId = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })
    const seeded = await t.run(async (ctx) => await ctx.db.query('pilots').first())
    if (!seeded) throw new Error('no pre-gen pilot')

    await u.as.mutation(api.ownership.claim, { table: 'pilots', entityId: seeded._id })
    const mine = await u.as.query(api.entities.listMine, {})
    // The template's body says `gameId: null`; the row is in the Game, and the
    // Dashboard opens only a pilot whose local copy says so.
    expect(mine.pilots.map((p) => (p.body as { gameId: unknown }).gameId)).toEqual([gameId])
  })

  test('a claimed pre-gen written by its body id updates its own row', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const gameId = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })
    const seeded = await t.run(async (ctx) => await ctx.db.query('pilots').first())
    if (!seeded) throw new Error('no pre-gen pilot')
    const bodyId = (seeded.body as { id: string }).id
    const before = await t.run(async (ctx) => (await ctx.db.query('pilots').collect()).length)

    await u.as.mutation(api.ownership.claim, { table: 'pilots', entityId: seeded._id })
    // The browser holds a claimed pre-gen under its body id, and writes it so.
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: bodyId,
      gameId,
      body: { ...(seeded.body as object), name: 'Renamed' },
      expectedUpdatedAt: null,
    })

    const pilots = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    // One row per pre-gen still: the write found the seeded row, not a second copy.
    expect(pilots).toHaveLength(before)
    const row = pilots.find((p) => p._id === seeded._id)
    expect((row?.body as { name: string } | undefined)?.name).toBe('Renamed')
    // Not stamped: the body id repeats in every Game made from the template.
    expect(row?.appId).toBeUndefined()
  })

  test('the same pre-gen claimed in two Games: a write lands in its own Game', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const first = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })
    const second = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })
    const pilots = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    const idOf = (p: { body: unknown }) => (p.body as { id: string }).id
    const bodyId = pilots[0] ? idOf(pilots[0]) : 'missing'
    const twins = pilots.filter((p) => idOf(p) === bodyId)
    expect(twins.map((p) => p.gameId).sort()).toEqual([first, second].sort())
    for (const twin of twins) {
      await u.as.mutation(api.ownership.claim, { table: 'pilots', entityId: twin._id })
    }

    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: bodyId,
      gameId: second,
      body: { ...(twins[0]?.body as object), gameId: second, name: 'Second' },
      expectedUpdatedAt: null,
    })

    const after = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    const nameIn = (gameId: string) => {
      const row = after.find((p) => p.gameId === gameId && idOf(p) === bodyId)
      return row ? (row.body as { name: string }).name : undefined
    }
    expect(nameIn(second)).toBe('Second')
    expect(nameIn(first)).not.toBe('Second')
    expect(after).toHaveLength(pilots.length)
  })

  test('an anonymous caller cannot create one', async () => {
    const t = testConvex()
    await expect(
      t.mutation(api.templates.createGame, { templateId: 'starter-set' })
    ).rejects.toThrow(/not signed in/i)
  })
})
