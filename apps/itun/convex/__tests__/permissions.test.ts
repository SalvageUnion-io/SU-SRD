import { describe, expect, test } from 'bun:test'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
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

describe('destroying a game preserves owned characters', () => {
  test('owned entities fall back to their owner shelf; unclaimed ones go', async () => {
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

    // An unclaimed entity has no shelf to fall back to. Keeping it would create
    // the one combination ADR-030 calls invalid: gameId null AND ownerId null.
    expect(unclaimed).toBeNull()
  })

  test('a Player cannot destroy the game', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    await expect(player.as.mutation(api.games.destroy, { gameId })).rejects.toThrow(/organizer/i)
  })
})
