import { describe, expect, test } from 'bun:test'
import { api } from '../_generated/api'
import { PRESENCE_WINDOW_MS } from '../mediator'
import { testConvex } from './harness'

/**
 * The Mediator surface's server layer.
 *
 * The NPC tray is the only genuinely secret thing in a Game, so most of these
 * tests are about it staying that way. A player who can read prepared
 * opposition can read the encounter before it happens — the one leak that
 * changes how the game is *played*, rather than merely who can edit what.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

/** A Game where `organizer` also mediates, plus a plain player. */
async function seedMediatedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Mediator')
  const player = await makeUser(t, 'Player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await organizer.as.mutation(api.games.setMediator, {
    gameId,
    userId: organizer.userId,
    mediator: true,
  })
  return { mediator: organizer, player, gameId }
}

describe('the NPC tray is Mediator-only', () => {
  test('the Mediator can read it', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'Wretch' } })

    const rows = await mediator.as.query(api.mediator.npcs, { gameId })
    expect(rows).toHaveLength(1)
  })

  test('a player in the same game cannot', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'Wretch' } })

    // Membership is not enough here, unlike everywhere else in the app.
    await expect(player.as.query(api.mediator.npcs, { gameId })).rejects.toThrow(/mediator/i)
  })

  test('a player cannot add, edit or remove one', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedMediatedGame(t)
    const npcId = await mediator.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'A' } })

    await expect(
      player.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'B' } })
    ).rejects.toThrow(/mediator/i)
    await expect(
      player.as.mutation(api.mediator.updateNpc, { npcId, body: { name: 'C' } })
    ).rejects.toThrow(/mediator/i)
    await expect(player.as.mutation(api.mediator.removeNpc, { npcId })).rejects.toThrow(/mediator/i)
  })

  test('an Organizer who does not mediate cannot read it either', async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const gm = await makeUser(t, 'GM')
    const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await gm.as.mutation(api.invites.redeem, { code })
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: gm.userId,
      mediator: true,
    })

    // The Organizer flag is administrative and confers no content authority —
    // reading prepared opposition is very much content.
    await expect(organizer.as.query(api.mediator.npcs, { gameId })).rejects.toThrow(/mediator/i)
  })
})

describe('the tray parses what it stores', () => {
  test('a malformed NPC body is rejected rather than persisted', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)

    // `encounterNpcs.body` is `v.any()`, so Convex itself cannot refuse any of
    // these — the mutation is the only thing standing between the tray and a
    // row nothing can read. A body with no name, a field the schema has never
    // heard of, a field of the wrong type, and something that is not an object
    // at all.
    for (const body of [{}, { name: 'Wretch', bogus: true }, { name: 42 }, 'Wretch']) {
      await expect(mediator.as.mutation(api.mediator.addNpc, { gameId, body })).rejects.toThrow(
        /invalid encounterNpcs payload/i
      )
    }

    const rows = await t.run(async (ctx) => await ctx.db.query('encounterNpcs').collect())
    expect(rows).toHaveLength(0)
  })

  test('an edit cannot replace a good body with a malformed one', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)
    const npcId = await mediator.as.mutation(api.mediator.addNpc, { gameId, body: { name: 'A' } })

    await expect(
      mediator.as.mutation(api.mediator.updateNpc, { npcId, body: { name: '', broken: 1 } })
    ).rejects.toThrow(/invalid encounterNpcs payload/i)

    // The refusal leaves the row as it was rather than half-written.
    const rows = await t.run(async (ctx) => await ctx.db.query('encounterNpcs').collect())
    expect((rows[0]?.body as { name?: string })?.name).toBe('A')
  })

  test('a fully tracked NPC instance parses too', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)

    // The tray accepts a bare name because that is what the Mediator surface
    // sends, but the fields it does carry are the local store's — so a complete
    // instance goes in unchanged rather than being refused by a schema that
    // only ever expected a name.
    await mediator.as.mutation(api.mediator.addNpc, {
      gameId,
      body: {
        id: 'npc1',
        schemaVersion: 1,
        refSchema: 'npcs',
        refSlug: 'wretch',
        refName: 'Wretch',
        name: 'Wretch 2',
        currentHp: 6,
        maxHp: 6,
        statKind: 'hp',
        conditions: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    const rows = await mediator.as.query(api.mediator.npcs, { gameId })
    expect((rows[0]?.body as { refSlug?: string })?.refSlug).toBe('wretch')
  })
})

describe('presence', () => {
  test('a heartbeat upserts rather than appending', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)

    await mediator.as.mutation(api.mediator.heartbeat, { gameId })
    await mediator.as.mutation(api.mediator.heartbeat, { gameId })
    await mediator.as.mutation(api.mediator.heartbeat, { gameId })

    // Otherwise a long session grows presence without bound.
    const rows = await t.run(async (ctx) => await ctx.db.query('presence').collect())
    expect(rows).toHaveLength(1)
  })

  test('present is computed from lastSeen, not stored', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedMediatedGame(t)
    await mediator.as.mutation(api.mediator.heartbeat, { gameId })

    // Backdate past the window: nothing had to turn a flag off.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query('presence').collect()) {
        await ctx.db.patch(row._id, { lastSeen: Date.now() - PRESENCE_WINDOW_MS - 1000 })
      }
    })

    const rows = await mediator.as.query(api.mediator.presence, { gameId })
    // A stored boolean needs something to clear it, and every such mechanism
    // can fail in a way that leaves somebody present forever.
    expect(rows[0]?.present).toBe(false)
  })

  test('any member may heartbeat and read presence', async () => {
    const t = testConvex()
    const { player, gameId } = await seedMediatedGame(t)
    await player.as.mutation(api.mediator.heartbeat, { gameId })

    // Presence is not privileged: a Mediator needs to see players arrive
    // exactly as much as players need to see each other.
    const rows = await player.as.query(api.mediator.presence, { gameId })
    expect(rows.some((r) => r.userId === player.userId && r.present)).toBe(true)
  })

  test('a non-member cannot heartbeat into a game they are not in', async () => {
    const t = testConvex()
    const { gameId } = await seedMediatedGame(t)
    const outsider = await makeUser(t, 'Outsider')

    await expect(outsider.as.mutation(api.mediator.heartbeat, { gameId })).rejects.toThrow(
      /not a member/i
    )
  })
})

describe('amMediator', () => {
  test('true for the Mediator, false for a player', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedMediatedGame(t)
    expect(await mediator.as.query(api.mediator.amMediator, { gameId })).toBe(true)
    expect(await player.as.query(api.mediator.amMediator, { gameId })).toBe(false)
  })

  test('false rather than a throw for a non-member', async () => {
    const t = testConvex()
    const { gameId } = await seedMediatedGame(t)
    const outsider = await makeUser(t, 'Outsider')

    // "Can I mediate this" is a reasonable question for anyone to ask, and a
    // surface gating itself on the answer should not have to catch.
    expect(await outsider.as.query(api.mediator.amMediator, { gameId })).toBe(false)
  })
})
