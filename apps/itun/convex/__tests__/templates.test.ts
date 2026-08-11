import { describe, expect, test } from 'bun:test'
import { api } from '../_generated/api'
import { testConvex } from './harness'

/**
 * Game templates (D34).
 *
 * The property under test is the one that makes a template useful rather than
 * decorative: **its entities arrive unclaimed**, so the person running the
 * table hands them out. A template that pre-assigned everything to its creator
 * would just be a private roster with extra steps.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

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

  test('the crawler is created communally, with no owner column at all', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const crawlers = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(crawlers.length).toBeGreaterThan(0)
    expect(crawlers[0]).not.toHaveProperty('ownerId')
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

  test('an anonymous caller cannot create one', async () => {
    const t = testConvex()
    await expect(
      t.mutation(api.templates.createGame, { templateId: 'starter-set' })
    ).rejects.toThrow(/not signed in/i)
  })
})
