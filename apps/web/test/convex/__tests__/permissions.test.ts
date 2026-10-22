import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import { makeUser, seedRawPilot, seedTable } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Authorization tests for Games (ADR-030 §3).
 *
 * These exist because the permission layer is the **security boundary for other
 * people's data**, and a rule enforced only in the UI is not enforced at all.
 * Every test here calls a real mutation as a specific identity — the same path
 * a browser takes — rather than unit-testing the helpers in isolation, because
 * the failure mode worth catching is a mutation that forgets to call them.
 */

describe('authentication', () => {
  test('an anonymous caller cannot create a game', async () => {
    const t = testConvex()
    await expect(t.mutation(api.games.create, { name: 'Nope' })).rejects.toThrow(/not signed in/i)
  })

  test('a non-member cannot read a game roster', async () => {
    const t = testConvex()
    const { gameId } = await seedTable(t)
    const outsider = await makeUser(t, 'Outsider')
    await expect(outsider.as.query(api.games.members, { gameId })).rejects.toThrow(/not a member/i)
  })
})

describe('roles are a base role plus one modifier', () => {
  test('the creator is Organizer AND a seated Player, not a third kind of thing', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    const roster = await organizer.as.query(api.games.members, { gameId })
    const me = roster.find((m) => m.userId === organizer.userId)

    expect(me?.organizer).toBe(true)
    // Mediator starts false: tables usually decide who runs it after the fact.
    expect(me?.mediator).toBe(false)
  })

  test('a joiner is a plain Player', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    const roster = await organizer.as.query(api.games.members, { gameId })
    const them = roster.find((m) => m.userId === player.userId)

    expect(them?.organizer).toBe(false)
    expect(them?.mediator).toBe(false)
  })

  test('a Player cannot delete the game', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await expect(player.as.mutation(api.games.destroy, { gameId })).rejects.toThrow(/organiser/i)
  })

  test('a Player cannot appoint a Mediator', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await expect(
      player.as.mutation(api.games.setMediator, {
        gameId,
        userId: player.userId,
        mediator: true,
      })
    ).rejects.toThrow(/organiser/i)
  })
})

describe('release', () => {
  test('an owner can release their own entity', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    const pilotId = await seedRawPilot(t, gameId, player.userId)

    await player.as.mutation(api.ownership.release, { table: 'pilots', entityId: pilotId })

    const pilot = await t.run(async (ctx) => await ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBeNull()
    // Unclaimed, not destroyed, and still in the game.
    expect(pilot?.gameId).toBe(gameId)
  })

  test("a bystander cannot release somebody else's entity", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    const pilotId = await seedRawPilot(t, gameId, player.userId)

    // The Organizer is not the owner and (here) not the Mediator either.
    await expect(
      organizer.as.mutation(api.ownership.release, { table: 'pilots', entityId: pilotId })
    ).rejects.toThrow(/owner or the mediator/i)
  })
})

describe('destroying a game preserves everything anybody built', () => {
  test("owned entities go to their owner's shelf; unclaimed ones to the deleter's", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    const ownedId = await seedRawPilot(t, gameId, player.userId)
    const unclaimedId = await seedRawPilot(t, gameId, null)

    await organizer.as.mutation(api.games.destroy, { gameId })

    const owned = await t.run(async (ctx) => await ctx.db.get(ownedId))
    const unclaimed = await t.run(async (ctx) => await ctx.db.get(unclaimedId))

    // Deleting a campaign must never delete somebody's character.
    expect(owned).not.toBeNull()
    expect(owned?.gameId).toBeNull()
    expect(owned?.ownerId).toBe(player.userId)

    // An unclaimed entity is not DELETED here, though it has no owner to fall
    // back to and `gameId: null` with `ownerId: null` is the one invalid
    // combination: the Organizer doing the deleting is a perfectly good owner, and is the person standing
    // in front of the consequence. So it survives, on their shelf.
    expect(unclaimed).not.toBeNull()
    expect(unclaimed?.gameId).toBeNull()
    expect(unclaimed?.ownerId).toBe(organizer.userId)
  })

  test('the crawler comes to the deleting Organizer, and stops being communal', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    const crawlerId = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          ownerId: null,
          body: { name: '#430' },
          updatedAt: 1,
        })
    )

    await organizer.as.mutation(api.games.destroy, { gameId })

    // The crawler is the crew's HOME, and it is not destroyed with the Game:
    // it falls back like everything else. `ownerId` moving from null to the Organizer is not a
    // change of heart about ADR-030 §5: communal is what a crawler is INSIDE a Game, and
    // this one is no longer in one.
    const crawler = await t.run(async (ctx) => await ctx.db.get(crawlerId))
    expect(crawler).not.toBeNull()
    expect(crawler?.gameId).toBeNull()
    expect(crawler?.ownerId).toBe(organizer.userId)
  })

  test('the table itself is gone — game, crew and invites', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)

    await organizer.as.mutation(api.games.destroy, { gameId })

    const game = await t.run(async (ctx) => await ctx.db.get(gameId))
    const memberships = await t.run(async (ctx) => await ctx.db.query('memberships').collect())
    expect(game).toBeNull()
    expect(memberships).toHaveLength(0)
  })

  test('a Player cannot destroy the game', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await expect(player.as.mutation(api.games.destroy, { gameId })).rejects.toThrow(/organiser/i)
  })

  test('a Mediator who is not the Organizer cannot destroy the game either', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: player.userId,
      mediator: true,
    })

    // Deliberate, and the reason `destroy` does not use `requireTableRunner`:
    // that helper hands authority to the Organizer only while a Game has no
    // Mediator, so who may end a campaign would otherwise depend on whether one
    // had been appointed yet.
    await expect(player.as.mutation(api.games.destroy, { gameId })).rejects.toThrow(/organiser/i)
  })
})

describe('listMine', () => {
  test('returns every game you belong to, with your role and the crew size', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)

    const mine = await organizer.as.query(api.games.listMine, {})
    expect(mine).toHaveLength(1)
    expect(mine[0]?._id).toBe(gameId)
    expect(mine[0]?.organizer).toBe(true)
    expect(mine[0]?.memberCount).toBe(2)

    // The same game, seen from the other side, reports the other role.
    const theirs = await player.as.query(api.games.listMine, {})
    expect(theirs[0]?.organizer).toBe(false)
  })

  test('is empty for somebody in no games', async () => {
    const t = testConvex()
    await seedTable(t)
    const outsider = await makeUser(t, 'Outsider')
    expect(await outsider.as.query(api.games.listMine, {})).toHaveLength(0)
  })

  test('an anonymous caller cannot list games', async () => {
    const t = testConvex()
    await expect(t.query(api.games.listMine, {})).rejects.toThrow(/not signed in/i)
  })
})

describe('requireMediator', () => {
  test('a Mediator passes, a plain Player does not', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: player.userId,
      mediator: true,
    })

    // setMediator is Organizer-gated, so exercise the Mediator gate through a
    // read that actually requires it: the opposition tray.
    expect(await player.as.query(api.mediator.npcs, { gameId })).toEqual([])
    // The Organizer holds no content authority by holding the flag.
    await expect(organizer.as.query(api.mediator.npcs, { gameId })).rejects.toThrow(/mediator/i)
  })
})

describe('the invite URL', () => {
  test('an unknown code is refused', async () => {
    const t = testConvex()
    await seedTable(t)
    const joiner = await makeUser(t, 'Joiner')
    await expect(joiner.as.mutation(api.invites.redeem, { code: 'NOPENOPE' })).rejects.toThrow(
      /not valid/i
    )
  })

  test('a Player can neither copy nor reset it', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await expect(player.as.mutation(api.invites.link, { gameId })).rejects.toThrow(/organiser/i)
    await expect(player.as.mutation(api.invites.reset, { gameId })).rejects.toThrow(/organiser/i)
  })
})

describe('a shelved entity cannot be released', () => {
  test('releasing one is refused, because null + null is the invalid state', async () => {
    const t = testConvex()
    const { organizer } = await seedTable(t)
    const shelved = await seedRawPilot(t, null, organizer.userId)

    // Release sets `ownerId: null`. On a shelved entity that would produce
    // `gameId: null && ownerId: null` — the one combination ADR-030 §2 calls
    // invalid and requires to be unreachable through any mutation. Hence a
    // refusal rather than a no-op.
    await expect(
      organizer.as.mutation(api.ownership.release, { table: 'pilots', entityId: shelved })
    ).rejects.toThrow(/already yours/i)

    const pilot = await t.run(async (ctx) => await ctx.db.get(shelved))
    expect(pilot?.ownerId).toBe(organizer.userId)
    expect(pilot?.gameId).toBeNull()
  })

  test('and the refusal does not call a shelved build "unclaimed"', async () => {
    const t = testConvex()
    const { organizer } = await seedTable(t)
    const shelved = await seedRawPilot(t, null, organizer.userId)

    // Not "An entity on a shelf is already unclaimed", which teaches the wrong
    // model to the person least able to check it: unclaimed is `ownerId: null`
    // *inside a Game*, waiting for a taker; a shelf is already somebody's.
    // `NotAuthorized` extends `ConvexError`, so the string reaches the player.
    const err = await organizer.as
      .mutation(api.ownership.release, { table: 'pilots', entityId: shelved })
      .catch((e: unknown) => e)

    expect(String((err as { data?: unknown })?.data ?? err)).not.toMatch(/unclaimed/i)
  })
})

describe('requireMediator', () => {
  test('rejects a member who does not mediate', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    const { requireMediator } = await import('../../../convex/model/permissions')

    // Exercised directly: an untested gate is the kind that quietly stops
    // gating.
    await expect(
      t.run(async (ctx) => {
        const withIdentity = {
          ...ctx,
          auth: { getUserIdentity: async () => ({ subject: player.userId }) },
        }
        return await requireMediator(withIdentity as never, gameId)
      })
    ).rejects.toThrow(/mediator/i)
  })
})
