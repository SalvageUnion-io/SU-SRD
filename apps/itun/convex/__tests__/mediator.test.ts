import { describe, expect, test } from 'bun:test'
import { api } from '../_generated/api'
import { testConvex } from './harness'

/**
 * The Mediator surface's server layer.
 *
 * The NPC tray is the only genuinely secret thing in a Game, so most of these
 * tests are about it staying that way. A player who can read prepared
 * opposition can read the encounter before it happens — the one leak that
 * changes how the game is *played*, rather than merely who can edit what.
 *
 * A `presence` block used to sit here, covering `heartbeat` and the
 * `PRESENCE_WINDOW_MS` staleness cutoff. Both are gone from `mediator.ts`: no
 * client ever called `heartbeat`, so the table had no writer and the query
 * always returned nothing, while `botClient.channel` read it and rendered a
 * permanently-false "0 at the table". The tests were dropped with the feature
 * rather than left skipped — see the module header in `../mediator.ts`, which
 * asks that any rebuild land the writer in the same change. Restore them then.
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
