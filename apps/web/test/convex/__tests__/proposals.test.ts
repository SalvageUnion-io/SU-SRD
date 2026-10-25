import { describe, expect, test } from 'bun:test'
import { MechSchema } from 'game-domain/schemas/mech'
import { api, internal } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx } from '../fixtures'
import { makeUser, mechBody, opRow, unitOp } from '../fixtures'
import { testConvex } from '../harness'

/**
 * Propose-and-confirm (ADR-030 §4).
 *
 * The thing being protected is that **a Mediator never writes a player's
 * sheet**. So the tests are less about the happy path and more about the ways
 * that promise could quietly erode: a force-apply path appearing, a proposal
 * expiring and dropping damage, or two contradictory pendings against one field.
 */

async function seedTable(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const player = await makeUser(t, 'Player')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.link, { gameId })
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
        body: MechSchema.parse(
          mechBody({ name: 'Mule', chassisRef: 'mule', currentSP: 10, currentHeat: 0 })
        ),
        updatedAt: 1,
      })
  )
  return { gm, player, gameId, mechId }
}

describe('the Mediator proposes; the player writes', () => {
  test('a proposal does not change the entity', async () => {
    const t = testConvex()
    const { gm, mechId } = await seedTable(t)

    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })

    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    // Still 10. Proposing is not writing.
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(10)
  })

  test('applying it does, and only the owner may', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })

    const [pending] = await player.as.query(api.ops.pending, { gameId })
    expect(pending).toBeDefined()

    // The Mediator cannot apply on the player's behalf — that would be the
    // direct write this whole mechanism exists to avoid.
    await expect(gm.as.mutation(api.ops.accept, { opId: String(pending?._id) })).rejects.toThrow(
      /only the owner/i
    )

    await player.as.mutation(api.ops.accept, { opId: String(pending?._id) })
    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(6)
  })

  test('applying a proposal against a field the sheet has no room for is refused', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      // A plausible miscasing. It is not a Mech field.
      field: 'currentSp',
      after: 6,
    })
    const [pending] = await player.as.query(api.ops.pending, { gameId })

    // Before the body was parsed on apply, this wrote a key nothing reads: the
    // player pressed Apply, the number did not move, and nothing said why.
    await expect(
      player.as.mutation(api.ops.accept, { opId: String(pending?._id) })
    ).rejects.toMatchObject({
      name: 'ConvexError',
      message: expect.stringMatching(/does not fit this sheet/i),
    })

    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(10)
  })

  test("a player cannot propose to their own or a crewmate's entity", async () => {
    const t = testConvex()
    const { player, mechId } = await seedTable(t)
    await expect(
      player.as.mutation(api.ops.propose, {
        entityId: mechId,
        entityType: 'mech',
        field: 'currentSP',
        after: 999,
      })
    ).rejects.toThrow(/mediator/i)
  })

  test('an unassigned entity cannot be proposed to', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    const orphan = await t.run(
      async (ctx) => await ctx.db.insert('mechs', { gameId, ownerId: null, body: {}, updatedAt: 1 })
    )

    // Nobody would ever see it, so it would sit pending forever.
    await expect(
      gm.as.mutation(api.ops.propose, {
        entityId: orphan,
        entityType: 'mech',
        field: 'currentSP',
        after: 1,
      })
    ).rejects.toThrow(/unassigned/i)
  })
})

describe('supersession, not expiry', () => {
  test('a newer proposal on the same field retires the older one', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)

    const first = await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })
    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 4,
    })

    const pending = await player.as.query(api.ops.pending, { gameId })
    // One pending, not two: a player is never asked to choose between
    // contradictory values for the same field.
    expect(pending).toHaveLength(1)
    expect(pending[0]?.after).toBe(4)

    expect((await opRow(t, first))?.state).toBe('superseded')
  })

  test('a proposal on a DIFFERENT field is left alone', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)

    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })
    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentHeat',
      after: 3,
    })

    // Supersession is per FIELD. Damage and heat are separate facts.
    expect(await player.as.query(api.ops.pending, { gameId })).toHaveLength(2)
  })

  test('nothing expires — an unanswered proposal stays pending', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    const id = await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })

    // Backdate it well past any plausible timeout. A timer here would silently
    // drop damage the player was meant to take.
    const op = await opRow(t, id)
    await t.run(async (ctx) => {
      if (op) await ctx.db.patch(op._id, { at: Date.now() - 1000 * 60 * 60 * 24 * 30 })
    })

    expect(await player.as.query(api.ops.pending, { gameId })).toHaveLength(1)
  })
})

describe('declining', () => {
  test('records rather than deletes, and leaves the entity alone', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    const id = await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })

    await player.as.mutation(api.ops.decline, { opId: id })

    const row = await opRow(t, id)
    // The log is append-only; a declined proposal is history, not a gap.
    expect(row?.state).toBe('declined')
    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    expect((mech?.body as { currentSP: number } | undefined)?.currentSP).toBe(10)
    expect(await player.as.query(api.ops.pending, { gameId })).toHaveLength(0)
  })
})

describe('pending is scoped to the asker', () => {
  test("a player is not shown proposals against a crewmate's entity", async () => {
    const t = testConvex()
    const { gm, gameId, mechId } = await seedTable(t)
    const bystander = await makeUser(t, 'Bystander')
    const code = await gm.as.mutation(api.invites.link, { gameId })
    await bystander.as.mutation(api.invites.redeem, { code })

    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })

    // Showing it would leak an edit in flight against a crewmate.
    expect(await bystander.as.query(api.ops.pending, { gameId })).toHaveLength(0)
  })
  test('a Game deleted under an open page reads empty, not as an error', async () => {
    // The page's subscription re-runs before it hears the Game is gone; the
    // Workers Issue this was ("Not a member of this Game", ops:pending)
    // reported that race as a defect.
    const t = testConvex()
    const { gm, player, gameId } = await seedTable(t)
    await gm.as.mutation(api.games.destroy, { gameId })

    expect(await player.as.query(api.ops.pending, { gameId })).toEqual([])
    expect(await gm.as.query(api.ops.sent, { gameId })).toEqual([])
  })
})

describe('only the Mediator proposes', () => {
  test("a player's own op cannot pose as a proposal", async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    const forged = unitOp('mech', { appId: mechId, gameId, patch: { currentSP: 3 } })

    await expect(
      player.as.mutation(api.ops.apply, {
        ...forged,
        op: { ...forged.op, source: 'mediator-proposal' },
      })
    ).rejects.toThrow('That change is not a proposal')

    expect(await gm.as.query(api.ops.sent, { gameId })).toEqual([])
    expect(await opRow(t, forged.op.id)).toBeNull()
  })
})

describe('alerts share the proposal bus', () => {
  test('the Mediator broadcasts and every member reads', async () => {
    const t = testConvex()
    const { gm, player, gameId } = await seedTable(t)
    await gm.as.mutation(api.changeLog.broadcast, { gameId, message: 'Sandstorm inbound' })

    const seen = await player.as.query(api.changeLog.alerts, { gameId })
    expect(seen[0]?.message).toBe('Sandstorm inbound')
  })

  test('newest first, capped at the limit, and nothing but alerts', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    await gm.as.mutation(api.changeLog.broadcast, { gameId, message: 'first' })
    // A proposal is a change-log row in the same Game — it must not surface here.
    await gm.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 6,
    })
    await gm.as.mutation(api.changeLog.broadcast, { gameId, message: 'second' })
    await gm.as.mutation(api.changeLog.broadcast, { gameId, message: 'third' })

    const all = await player.as.query(api.changeLog.alerts, { gameId })
    expect(all.map((a) => a.message)).toEqual(['third', 'second', 'first'])

    const two = await player.as.query(api.changeLog.alerts, { gameId, limit: 2 })
    expect(two.map((a) => a.message)).toEqual(['third', 'second'])
  })

  test('a player cannot broadcast', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)
    await expect(
      player.as.mutation(api.changeLog.broadcast, { gameId, message: 'free scrap' })
    ).rejects.toThrow(/mediator/i)
  })

  test('an alert does not appear as a pending proposal', async () => {
    const t = testConvex()
    const { gm, player, gameId } = await seedTable(t)
    await gm.as.mutation(api.changeLog.broadcast, { gameId, message: 'Sandstorm' })

    // An alert is a feed row, not an op: there is no unit to answer for.
    expect(await player.as.query(api.ops.pending, { gameId })).toHaveLength(0)
  })
})

describe('a proposal written to the Change Log before proposals were ops', () => {
  test('is copied into ops once, then answers like any other', async () => {
    const t = testConvex()
    const { gm, player, gameId, mechId } = await seedTable(t)
    const legacy = await t.run(
      async (ctx) =>
        await ctx.db.insert('changeLog', {
          gameId,
          entityType: 'mech',
          entityId: mechId,
          ts: 1,
          kind: 'transaction',
          field: 'currentHeat',
          before: null,
          after: 3,
          source: 'mediator-proposal',
          actorId: gm.userId,
          state: 'proposed',
          reason: 'Overheat',
        })
    )
    expect(await player.as.query(api.ops.pending, { gameId })).toEqual([])

    const first = await t.mutation(internal.ops.copyLegacyProposals, { cursor: null })
    expect(first).toMatchObject({ copied: 1, done: true })
    expect((await t.mutation(internal.ops.copyLegacyProposals, { cursor: null })).copied).toBe(0)

    const [pending] = await player.as.query(api.ops.pending, { gameId })
    expect(pending).toMatchObject({
      _id: legacy,
      field: 'currentHeat',
      after: 3,
      reason: 'Overheat',
    })
    await player.as.mutation(api.ops.accept, { opId: legacy })
    const mech = await t.run(async (ctx) => await ctx.db.get(mechId as Id<'mechs'>))
    expect((mech?.body as { currentHeat?: number } | undefined)?.currentHeat).toBe(3)
  })
})
