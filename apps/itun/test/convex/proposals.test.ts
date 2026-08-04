import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { MechSchema } from '../../src/lib/schemas/mech'
import { testConvex } from './harness'

/**
 * Propose-and-confirm (D7, D25).
 *
 * The thing being protected is that **a Mediator never writes a player's
 * sheet**. So the tests are less about the happy path and more about the ways
 * that promise could quietly erode: a force-apply path appearing, a proposal
 * expiring and dropping damage, or two contradictory pendings against one field.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

async function seedTable(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const player = await makeUser(t, 'Player')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })

  /**
   * A REAL mech body, parsed by the schema rather than hand-sketched.
   *
   * `apply` now Zod-parses the merged body before it persists, which means a
   * fixture that is not a valid Mech cannot be applied to — correctly, since no
   * production write path can produce one. The earlier two-field sketch also
   * spelled the field `currentSp`, which the schema does not define, so the
   * proposal it applied added a key nothing reads and every assertion passed
   * anyway. Parsing here is what stops this file agreeing with that bug.
   */
  const mechId = await t.run(
    async (ctx) =>
      await ctx.db.insert('mechs', {
        gameId,
        ownerId: player.userId,
        body: MechSchema.parse({
          id: 'm1',
          schemaVersion: 1,
          name: 'Mule',
          chassisRef: 'mule',
          systems: [],
          modules: [],
          cargoLots: [],
          conditions: [],
          currentSP: 10,
          currentHeat: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        updatedAt: 1,
      })
  )
  return { gm, player, gameId, mechId }
}

describe('the Mediator proposes; the player writes', () => {
  test('a proposal does not change the entity', async () => {
    const t = testConvex()
    const { gm, mechId } = await seedTable(t)

    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 6,
    })

    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    // Still 10. Proposing is not writing.
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(10)
  })

  test('applying it does, and only the owner may', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 6,
    })

    const [pending] = await player.as.query(api.proposals.pending, { gameId })
    expect(pending).toBeDefined()

    // The Mediator cannot apply on the player's behalf — that would be the
    // direct write this whole mechanism exists to avoid.
    await expect(
      gm.as.mutation(api.proposals.apply, { proposalId: pending?._id as Id<'changeLog'> })
    ).rejects.toThrow(/only the owner/i)

    await player.as.mutation(api.proposals.apply, {
      proposalId: pending?._id as Id<'changeLog'>,
    })
    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(6)
  })

  test('applying a proposal against a field the sheet has no room for is refused', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      // The casing the Mediator surface used to offer. It is not a Mech field.
      field: 'currentSp',
      before: 10,
      after: 6,
    })
    const [pending] = await player.as.query(api.proposals.pending, { gameId })

    // Before the body was parsed on apply, this wrote a key nothing reads: the
    // player pressed Apply, the number did not move, and nothing said why.
    await expect(
      player.as.mutation(api.proposals.apply, { proposalId: pending?._id as Id<'changeLog'> })
    ).rejects.toThrow(/does not fit this sheet/i)

    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(10)
  })

  test("a player cannot propose to their own or a crewmate's entity", async () => {
    const t = testConvex()
    const { player, mechId } = await seedTable(t)
    await expect(
      player.as.mutation(api.proposals.propose, {
        entityId: mechId,
        entityType: 'mech',
        field: 'currentSP',
        before: 10,
        after: 999,
      })
    ).rejects.toThrow(/mediator/i)
  })

  test('an unclaimed entity cannot be proposed to', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    const orphan = await t.run(
      async (ctx) => await ctx.db.insert('mechs', { gameId, ownerId: null, body: {}, updatedAt: 1 })
    )

    // Nobody would ever see it, so it would sit pending forever.
    await expect(
      gm.as.mutation(api.proposals.propose, {
        entityId: orphan,
        entityType: 'mech',
        field: 'currentSP',
        before: 0,
        after: 1,
      })
    ).rejects.toThrow(/unclaimed/i)
  })
})

describe('supersession, not expiry', () => {
  test('a newer proposal on the same field retires the older one', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)

    const first = await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 6,
    })
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 4,
    })

    const pending = await player.as.query(api.proposals.pending, { gameId })
    // One pending, not two: a player is never asked to choose between
    // contradictory values for the same field.
    expect(pending).toHaveLength(1)
    expect(pending[0]?.after).toBe(4)

    const old = await t.run(async (ctx) => await ctx.db.get(first))
    expect(old?.state).toBe('superseded')
    expect(old?.supersededBy).toBeDefined()
  })

  test('a proposal on a DIFFERENT field is left alone', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)

    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 6,
    })
    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentHeat',
      before: 0,
      after: 3,
    })

    // Supersession is per FIELD. Damage and heat are separate facts.
    expect(await player.as.query(api.proposals.pending, { gameId })).toHaveLength(2)
  })

  test('nothing expires — an unanswered proposal stays pending', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    const id = await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 6,
    })

    // Backdate it well past any plausible timeout. A timer here would silently
    // drop damage the player was meant to take.
    await t.run(async (ctx) => {
      await ctx.db.patch(id, { ts: Date.now() - 1000 * 60 * 60 * 24 * 30 })
    })

    expect(await player.as.query(api.proposals.pending, { gameId })).toHaveLength(1)
  })
})

describe('declining', () => {
  test('records rather than deletes, and leaves the entity alone', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    const id = await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 6,
    })

    await player.as.mutation(api.proposals.decline, { proposalId: id })

    const row = await t.run(async (ctx) => await ctx.db.get(id))
    // The log is append-only; a declined proposal is history, not a gap.
    expect(row?.state).toBe('declined')
    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(10)
    expect(await player.as.query(api.proposals.pending, { gameId })).toHaveLength(0)
  })
})

describe('pending is scoped to the asker', () => {
  test("a player is not shown proposals against a crewmate's entity", async () => {
    const t = testConvex()
    const { gm, gameId, mechId } = await seedTable(t)
    const bystander = await makeUser(t, 'Bystander')
    const code = await gm.as.mutation(api.invites.create, { gameId })
    await bystander.as.mutation(api.invites.redeem, { code })

    await gm.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      before: 10,
      after: 6,
    })

    // Showing it would leak an edit in flight against a crewmate.
    expect(await bystander.as.query(api.proposals.pending, { gameId })).toHaveLength(0)
  })
})

describe('alerts share the proposal bus', () => {
  test('the Mediator broadcasts and every member reads', async () => {
    const t = testConvex()
    const { gm, player, gameId } = await seedTable(t)
    await gm.as.mutation(api.proposals.broadcast, { gameId, message: 'Sandstorm inbound' })

    const seen = await player.as.query(api.proposals.alerts, { gameId })
    expect(seen[0]?.message).toBe('Sandstorm inbound')
  })

  test('a player cannot broadcast', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await expect(
      player.as.mutation(api.proposals.broadcast, { gameId, message: 'free scrap' })
    ).rejects.toThrow(/mediator/i)
  })

  test('an alert does not appear as a pending proposal', async () => {
    const t = testConvex()
    const { gm, player, gameId } = await seedTable(t)
    await gm.as.mutation(api.proposals.broadcast, { gameId, message: 'Sandstorm' })

    // Same table, different shape — an alert has no entity to answer for.
    expect(await player.as.query(api.proposals.pending, { gameId })).toHaveLength(0)
  })
})
