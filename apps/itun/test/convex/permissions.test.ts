import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testConvex } from './harness'

/**
 * Authorization tests for Games (ADR-030 §3).
 *
 * These exist because the permission layer is the **security boundary for other
 * people's data**, and a rule enforced only in the UI is not enforced at all.
 * Every test here calls a real mutation as a specific identity — the same path
 * a browser takes — rather than unit-testing the helpers in isolation, because
 * the failure mode worth catching is a mutation that forgets to call them.
 */

type Ctx = ReturnType<typeof testConvex>

/** Seed a user row and return an identity-bound handle for it. */
async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', { name, displayName: name })
  })
  return { userId, as: t.withIdentity({ subject: userId }) }
}

/** A Game created by `organizer`, plus a second member who is a plain Player. */
async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const player = await makeUser(t, 'Player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })

  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })

  return { organizer, player, gameId }
}

async function seedPilot(t: Ctx, gameId: Id<'games'> | null, ownerId: Id<'users'> | null) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('pilots', {
      gameId,
      ownerId,
      body: { callsign: 'Roach-Boy' },
      updatedAt: Date.now(),
    })
  })
}

describe('authentication', () => {
  test('an anonymous caller cannot create a game', async () => {
    const t = testConvex()
    await expect(t.mutation(api.games.create, { name: 'Nope' })).rejects.toThrow(/not signed in/i)
  })

  test('a non-member cannot read a game roster', async () => {
    const t = testConvex()
    const { gameId } = await seedGame(t)
    const outsider = await makeUser(t, 'Outsider')
    await expect(outsider.as.query(api.games.members, { gameId })).rejects.toThrow(/not a member/i)
  })
})

describe('roles are a base role plus one modifier', () => {
  test('the creator is Organizer AND a seated Player, not a third kind of thing', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const roster = await organizer.as.query(api.games.members, { gameId })
    const me = roster.find((m) => m.userId === organizer.userId)

    expect(me?.organizer).toBe(true)
    // Mediator starts false: tables usually decide who runs it after the fact.
    expect(me?.mediator).toBe(false)
  })

  test('a joiner is a plain Player', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const roster = await organizer.as.query(api.games.members, { gameId })
    const them = roster.find((m) => m.userId === player.userId)

    expect(them?.organizer).toBe(false)
    expect(them?.mediator).toBe(false)
  })

  test('a Player cannot rename the game', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    await expect(player.as.mutation(api.games.rename, { gameId, name: 'Mine' })).rejects.toThrow(
      /organizer/i
    )
  })

  test('a Player cannot appoint a Mediator', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    await expect(
      player.as.mutation(api.games.setMediator, {
        gameId,
        userId: player.userId,
        mediator: true,
      })
    ).rejects.toThrow(/organizer/i)
  })
})

describe('transferOrganizer keeps exactly one Organizer', () => {
  test('after transfer there is exactly one, and it is the new holder', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)

    await organizer.as.mutation(api.games.transferOrganizer, { gameId, userId: player.userId })

    // Read as the NEW organizer — the old one is now a plain Player.
    const roster = await player.as.query(api.games.members, { gameId })
    const organizers = roster.filter((m) => m.organizer)

    expect(organizers).toHaveLength(1)
    expect(organizers[0]?.userId).toBe(player.userId)
  })

  test('the previous Organizer loses administrative power', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await organizer.as.mutation(api.games.transferOrganizer, { gameId, userId: player.userId })

    await expect(
      organizer.as.mutation(api.games.rename, { gameId, name: 'Take-backs' })
    ).rejects.toThrow(/organizer/i)
  })

  test('transferring to yourself is a no-op, not a way to end up with none', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    await organizer.as.mutation(api.games.transferOrganizer, { gameId, userId: organizer.userId })

    const roster = await organizer.as.query(api.games.members, { gameId })
    expect(roster.filter((m) => m.organizer)).toHaveLength(1)
  })
})

describe('ownership assignment (ADR-030 §3 — the Organizer fallback)', () => {
  test('a plain Player cannot assign ownership', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, null)

    await expect(
      player.as.mutation(api.ownership.assign, {
        table: 'pilots',
        entityId: pilotId,
        toUserId: player.userId,
      })
    ).rejects.toThrow(/mediator/i)
  })

  test('the Organizer CAN assign while the game has no Mediator', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, null)

    await organizer.as.mutation(api.ownership.assign, {
      table: 'pilots',
      entityId: pilotId,
      toUserId: player.userId,
    })

    const pilot = await t.run(async (ctx) => await ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBe(player.userId)
  })

  test('the Organizer LOSES that power once a Mediator exists', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, null)

    // The fallback is conditional, and this is the condition ending.
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: player.userId,
      mediator: true,
    })

    await expect(
      organizer.as.mutation(api.ownership.assign, {
        table: 'pilots',
        entityId: pilotId,
        toUserId: organizer.userId,
      })
    ).rejects.toThrow(/mediator/i)
  })

  test('the Mediator can assign', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, null)

    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: player.userId,
      mediator: true,
    })
    await player.as.mutation(api.ownership.assign, {
      table: 'pilots',
      entityId: pilotId,
      toUserId: organizer.userId,
    })

    const pilot = await t.run(async (ctx) => await ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBe(organizer.userId)
  })

  test('ownership cannot be assigned to a non-member', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const outsider = await makeUser(t, 'Outsider')
    const pilotId = await seedPilot(t, gameId, null)

    // Otherwise the entity becomes unreachable — owned by someone with no
    // membership through which to see it.
    await expect(
      organizer.as.mutation(api.ownership.assign, {
        table: 'pilots',
        entityId: pilotId,
        toUserId: outsider.userId,
      })
    ).rejects.toThrow(/not a member/i)
  })

  test('every assignment is recorded on the Change Log', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, null)

    await organizer.as.mutation(api.ownership.assign, {
      table: 'pilots',
      entityId: pilotId,
      toUserId: player.userId,
    })

    const entries = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(entries).toHaveLength(1)
    expect(entries[0]?.field).toBe('ownerId')
    expect(entries[0]?.before).toBeNull()
    expect(entries[0]?.after).toBe(player.userId)
    expect(entries[0]?.actorId).toBe(organizer.userId)
    expect(entries[0]?.state).toBe('applied')
  })
})

describe('release', () => {
  test('an owner can release their own entity', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, player.userId)

    await player.as.mutation(api.ownership.release, { table: 'pilots', entityId: pilotId })

    const pilot = await t.run(async (ctx) => await ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBeNull()
    // Unclaimed, not destroyed, and still in the game.
    expect(pilot?.gameId).toBe(gameId)
  })

  test("a bystander cannot release somebody else's entity", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, player.userId)

    // The Organizer is not the owner and (here) not the Mediator either.
    await expect(
      organizer.as.mutation(api.ownership.release, { table: 'pilots', entityId: pilotId })
    ).rejects.toThrow(/owner or the mediator/i)
  })
})

describe('leaving a game', () => {
  test('a departing Player leaves their entities behind, unclaimed', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const pilotId = await seedPilot(t, gameId, player.userId)

    await player.as.mutation(api.ownership.leaveGame, { gameId })

    const pilot = await t.run(async (ctx) => await ctx.db.get(pilotId))
    // The crew survives a departure; nothing is destroyed.
    expect(pilot?.gameId).toBe(gameId)
    expect(pilot?.ownerId).toBeNull()
  })

  test('the Organizer cannot leave without handing the flag on', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    // A game with no Organizer has nobody who can invite, rename, or delete it.
    await expect(organizer.as.mutation(api.ownership.leaveGame, { gameId })).rejects.toThrow(
      /transfer the organizer/i
    )
  })
})

describe('destroying a game preserves everything anybody built', () => {
  test("owned entities go to their owner's shelf; unclaimed ones to the deleter's", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const ownedId = await seedPilot(t, gameId, player.userId)
    const unclaimedId = await seedPilot(t, gameId, null)

    await organizer.as.mutation(api.games.destroy, { gameId })

    const owned = await t.run(async (ctx) => await ctx.db.get(ownedId))
    const unclaimed = await t.run(async (ctx) => await ctx.db.get(unclaimedId))

    // Deleting a campaign must never delete somebody's character.
    expect(owned).not.toBeNull()
    expect(owned?.gameId).toBeNull()
    expect(owned?.ownerId).toBe(player.userId)

    // An unclaimed entity used to be DELETED here, because it had no owner to
    // fall back to and `gameId: null` with `ownerId: null` is the one invalid
    // combination. Deleting was never the only way out of that: the Organizer
    // doing the deleting is a perfectly good owner, and is the person standing
    // in front of the consequence. So it survives, on their shelf.
    expect(unclaimed).not.toBeNull()
    expect(unclaimed?.gameId).toBeNull()
    expect(unclaimed?.ownerId).toBe(organizer.userId)
  })

  test('the crawler comes to the deleting Organizer, and stops being communal', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
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

    // The crawler is the crew's HOME, and it used to be destroyed with the Game
    // — the one build that a deletion could take with it. It now falls back like
    // everything else. `ownerId` moving from null to the Organizer is not a
    // change of heart about D8: communal is what a crawler is INSIDE a Game, and
    // this one is no longer in one.
    const crawler = await t.run(async (ctx) => await ctx.db.get(crawlerId))
    expect(crawler).not.toBeNull()
    expect(crawler?.gameId).toBeNull()
    expect(crawler?.ownerId).toBe(organizer.userId)
  })

  test('the table itself is gone — game, crew and invites', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)

    await organizer.as.mutation(api.games.destroy, { gameId })

    const game = await t.run(async (ctx) => await ctx.db.get(gameId))
    const memberships = await t.run(async (ctx) => await ctx.db.query('memberships').collect())
    expect(game).toBeNull()
    expect(memberships).toHaveLength(0)
  })

  test('a Player cannot destroy the game', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    await expect(player.as.mutation(api.games.destroy, { gameId })).rejects.toThrow(/organizer/i)
  })

  test('a Mediator who is not the Organizer cannot destroy the game either', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: player.userId,
      mediator: true,
    })

    // Deliberate, and the reason `destroy` does not use `requireTableRunner`:
    // that helper hands authority to the Organizer only while a Game has no
    // Mediator, so who may end a campaign would otherwise depend on whether one
    // had been appointed yet.
    await expect(player.as.mutation(api.games.destroy, { gameId })).rejects.toThrow(/organizer/i)
  })
})

describe('listMine', () => {
  test('returns every game you belong to, with your role and the crew size', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)

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
    await seedGame(t)
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
    const { organizer, player, gameId } = await seedGame(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: player.userId,
      mediator: true,
    })

    // setMediator is Organizer-gated, so exercise the Mediator gate through a
    // mutation that actually requires it.
    const pilotId = await seedPilot(t, gameId, null)
    await player.as.mutation(api.ownership.assign, {
      table: 'pilots',
      entityId: pilotId,
      toUserId: organizer.userId,
    })

    const pilot = await t.run(async (ctx) => await ctx.db.get(pilotId))
    expect(pilot?.ownerId).toBe(organizer.userId)
  })
})

describe('invite lifecycle', () => {
  test('an expired code is refused', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Late')
    const code = await organizer.as.mutation(api.invites.create, { gameId })

    await t.run(async (ctx) => {
      for (const row of await ctx.db.query('invites').collect()) {
        await ctx.db.patch(row._id, { expiresAt: Date.now() - 1000 })
      }
    })

    await expect(joiner.as.mutation(api.invites.redeem, { code })).rejects.toThrow(/expired/i)
  })

  test('a used-up code is refused, and uses decrement', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const first = await makeUser(t, 'First')
    const second = await makeUser(t, 'Second')
    const code = await organizer.as.mutation(api.invites.create, { gameId, usesRemaining: 1 })

    await first.as.mutation(api.invites.redeem, { code })
    await expect(second.as.mutation(api.invites.redeem, { code })).rejects.toThrow(/used up/i)
  })

  test('redeeming twice does not consume a second use', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Joiner')
    const code = await organizer.as.mutation(api.invites.create, { gameId, usesRemaining: 2 })

    await joiner.as.mutation(api.invites.redeem, { code })
    await joiner.as.mutation(api.invites.redeem, { code })

    // Tapping a link twice should land you in the game, not cost the table a
    // seat it did not give away.
    //
    // Selected BY CODE: seedGame already minted an invite, so index 0 is a
    // different row entirely — the first draft of this test asserted against it
    // and failed for the wrong reason.
    const invite = await t.run(async (ctx) =>
      (await ctx.db.query('invites').collect()).find((i) => i.code === code)
    )
    expect(invite?.usesRemaining).toBe(1)
  })

  test('an unknown code is refused', async () => {
    const t = testConvex()
    await seedGame(t)
    const joiner = await makeUser(t, 'Joiner')
    await expect(joiner.as.mutation(api.invites.redeem, { code: 'NOPENOPE' })).rejects.toThrow(
      /not valid/i
    )
  })

  test('the Organizer can revoke a code before it is used', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const joiner = await makeUser(t, 'Joiner')
    const code = await organizer.as.mutation(api.invites.create, { gameId })

    const invite = await t.run(async (ctx) =>
      (await ctx.db.query('invites').collect()).find((i) => i.code === code)
    )
    await organizer.as.mutation(api.invites.revoke, { inviteId: invite?._id as never })

    // "revoked", not "not valid": revocation is now a soft delete, so the row
    // survives to keep its redemption history resolvable and the refusal can say
    // what actually happened instead of pretending the code never existed.
    await expect(joiner.as.mutation(api.invites.redeem, { code })).rejects.toThrow(/revoked/i)
  })

  test('a Player cannot revoke', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    const invite = await t.run(async (ctx) =>
      (await ctx.db.query('invites').collect()).find((i) => i.code === code)
    )

    await expect(
      player.as.mutation(api.invites.revoke, { inviteId: invite?._id as never })
    ).rejects.toThrow(/organizer/i)
  })
})

describe('a shelved entity is not assignable', () => {
  test('assigning one is refused, because there is no game to assign within', async () => {
    const t = testConvex()
    const { organizer } = await seedGame(t)
    const shelved = await seedPilot(t, null, organizer.userId)

    // Ownership only means something inside a crew. On a shelf the entity
    // already belongs to exactly one person and there is nobody to hand it to.
    await expect(
      organizer.as.mutation(api.ownership.assign, {
        table: 'pilots',
        entityId: shelved,
        toUserId: organizer.userId,
      })
    ).rejects.toThrow(/shelf/i)
  })

  test('releasing one is refused, because null + null is the invalid state', async () => {
    const t = testConvex()
    const { organizer } = await seedGame(t)
    const shelved = await seedPilot(t, null, organizer.userId)

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
    const { organizer } = await seedGame(t)
    const shelved = await seedPilot(t, null, organizer.userId)

    // The message used to be "An entity on a shelf is already unclaimed", which
    // teaches the wrong model to the person least able to check it: unclaimed
    // is `ownerId: null` *inside a Game*, waiting for a taker; a shelf is
    // already somebody's. It matters more now that `NotAuthorized` extends
    // `ConvexError` and the string actually reaches the player.
    const err = await organizer.as
      .mutation(api.ownership.release, { table: 'pilots', entityId: shelved })
      .catch((e: unknown) => e)

    expect(String((err as { data?: unknown })?.data ?? err)).not.toMatch(/unclaimed/i)
  })
})

describe('requireMediator', () => {
  test('rejects a member who does not mediate', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const { requireMediator } = await import('../../convex/model/permissions')

    // Exercised directly: this PR ships the helper ahead of its Phase 3
    // callers, and an untested gate is the kind that quietly stops gating.
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
