import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { Ctx } from './assignmentFixtures'
import { addMech, addPilot, makeUser, seedTable } from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * One entity's Change Log, as the sheet's drawer reads it (`changeLog.forEntity`).
 *
 * The log used to be two spines: the drawer read a device-only IndexedDB copy,
 * so a proposal, an ownership change, or an edit made on another device never
 * showed. These pin that the server's one table is the whole history, read by
 * the id the client addresses the entity by, and that the rows written before
 * every writer used that id still appear.
 */

async function seedMech(t: Ctx) {
  const table = await seedTable(t)
  const { organizer, player, gameId } = table
  await organizer.as.mutation(api.games.setMediator, {
    gameId,
    userId: organizer.userId,
    mediator: true,
  })
  await addMech(player, 'm-app', gameId)
  const mechId = await t.run(async (ctx) => {
    const row = await ctx.db
      .query('mechs')
      .withIndex('by_app_id', (q) => q.eq('appId', 'm-app'))
      .unique()
    if (row === null) throw new Error('expected the mech')
    return row._id
  })
  return { ...table, mechId }
}

function edit(gameId: Id<'games'>, ts: number) {
  return {
    gameId,
    entityType: 'mech' as const,
    entityId: 'm-app',
    ts,
    kind: 'manual' as const,
    field: 'name',
    before: 'Mule',
    after: 'Rook',
    source: 'live-sheet',
  }
}

describe('changeLog.forEntity', () => {
  test('edits, proposals and pre-change rows, newest first; answered proposals left out', async () => {
    const t = testConvex()
    const { organizer, player, gameId, mechId } = await seedMech(t)

    await player.as.mutation(api.changeLog.appendChangeLog, { entries: [edit(gameId, 1)] })
    // The Mediator's client addresses the mech by its row id; the row names it
    // by the app id its sheet's log is read by.
    const pending = await organizer.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 4,
    })
    const declined = await organizer.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentHeat',
      after: 2,
    })
    await player.as.mutation(api.proposals.decline, { proposalId: declined })
    // A row written before proposals and ownership used the app id.
    await t.run(async (ctx) => {
      await ctx.db.insert('changeLog', {
        gameId,
        entityType: 'mech',
        entityId: mechId,
        ts: 0,
        kind: 'transaction',
        field: 'ownerId',
        before: null,
        after: player.userId,
        source: 'ownership',
        actorId: organizer.userId,
        state: 'applied',
      })
    })

    const log = await player.as.query(api.changeLog.forEntity, {
      entityType: 'mech',
      entityId: 'm-app',
    })

    expect(log.map((r) => [r.field, r.state])).toEqual([
      ['currentSP', 'proposed'],
      ['name', 'applied'],
      ['ownerId', 'applied'],
    ])
    const proposal = await t.run(async (ctx) => await ctx.db.get(pending))
    expect(proposal?.entityId).toBe('m-app')
    expect(proposal?.before).toBeNull()
  })

  test('a crewmate reads it; somebody outside the Game does not', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedMech(t)
    await player.as.mutation(api.changeLog.appendChangeLog, { entries: [edit(gameId, 1)] })
    const stranger = await makeUser(t, 'Stranger')

    const args = { entityType: 'mech' as const, entityId: 'm-app' }
    expect(await organizer.as.query(api.changeLog.forEntity, args)).toHaveLength(1)
    await expect(stranger.as.query(api.changeLog.forEntity, args)).rejects.toThrow(
      /Not a member of this game/
    )
  })

  test("a shelf build's log is its owner's alone", async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const other = await makeUser(t, 'Other')
    await addPilot(owner, 'p-app', null)

    const args = { entityType: 'pilot' as const, entityId: 'p-app' }
    expect(await owner.as.query(api.changeLog.forEntity, args)).toEqual([])
    await expect(other.as.query(api.changeLog.forEntity, args)).rejects.toThrow(/not yours to read/)
  })

  test('an entity the server has no row for reads as empty', async () => {
    const t = testConvex()
    const user = await makeUser(t, 'Solo')
    expect(
      await user.as.query(api.changeLog.forEntity, { entityType: 'crawler', entityId: 'nope' })
    ).toEqual([])
  })

  test('ownership changes are named by the app id too', async () => {
    const t = testConvex()
    const { player, mechId } = await seedMech(t)
    await player.as.mutation(api.ownership.release, { table: 'mechs', entityId: mechId })

    const log = await player.as.query(api.changeLog.forEntity, {
      entityType: 'mech',
      entityId: 'm-app',
    })
    expect(log.map((r) => r.field)).toContain('ownerId')
  })
})

describe('a proposal written before it carried the app id', () => {
  test('is still pending for its owner, and still applies', async () => {
    const t = testConvex()
    const { organizer, player, gameId, mechId } = await seedMech(t)
    const proposalId = await t.run(
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
          actorId: organizer.userId,
          state: 'proposed',
        })
    )

    expect((await player.as.query(api.proposals.pending, { gameId })).map((p) => p._id)).toEqual([
      proposalId,
    ])
    await player.as.mutation(api.proposals.apply, { proposalId })
    const mech = await t.run(async (ctx) => await ctx.db.get(mechId))
    expect((mech?.body as { currentHeat?: number } | undefined)?.currentHeat).toBe(3)
  })

  test('is superseded by a newer proposal against the same field', async () => {
    const t = testConvex()
    const { organizer, gameId, mechId } = await seedMech(t)
    const old = await t.run(
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
          actorId: organizer.userId,
          state: 'proposed',
        })
    )

    await organizer.as.mutation(api.proposals.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentHeat',
      after: 5,
    })

    expect((await t.run(async (ctx) => await ctx.db.get(old)))?.state).toBe('superseded')
  })
})
