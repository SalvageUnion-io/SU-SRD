import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx } from '../fixtures'
import { addMech, addPilot, makeUser, opRow, seedTable, unitOp } from '../fixtures'
import { testConvex } from '../harness'

/**
 * One entity's Change Log, as the sheet's drawer reads it (`changeLog.forEntity`).
 *
 * The log is one spine: a device-only copy would never show a proposal, an
 * ownership change, or an edit made on another device. These pin that the
 * unit's ops and the rows logged beside them are the whole history, read by the
 * id the client addresses the entity by, and that the rows written before
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

/** The player renames their mech: an op (ADR-063). */
function rename(gameId: Id<'games'>) {
  return unitOp('mech', { appId: 'm-app', gameId, patch: { name: 'Rook' } })
}

describe('changeLog.forEntity', () => {
  test('edits, proposals and pre-change rows, newest first; answered proposals left out', async () => {
    const t = testConvex()
    const { organizer, player, gameId, mechId } = await seedMech(t)

    await player.as.mutation(api.ops.apply, rename(gameId))
    // The Mediator's client addresses the mech by its row id; the row names it
    // by the app id its sheet's log is read by.
    const pending = await organizer.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentSP',
      after: 4,
    })
    const declined = await organizer.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentHeat',
      after: 2,
    })
    await player.as.mutation(api.ops.decline, { opId: declined })
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
    const proposal = await opRow(t, pending)
    expect(proposal?.unitId).toBe('m-app')
    expect(proposal?.before).toBeNull()
  })

  test('an op is a row per field it wrote, with what each held; an applied proposal shows once', async () => {
    const t = testConvex()
    const { organizer, player, gameId, mechId } = await seedMech(t)
    await player.as.mutation(api.ops.apply, rename(gameId))
    const opId = await organizer.as.mutation(api.ops.propose, {
      entityId: mechId,
      entityType: 'mech',
      field: 'currentHeat',
      after: 2,
    })
    await player.as.mutation(api.ops.accept, { opId })

    const log = await player.as.query(api.changeLog.forEntity, {
      entityType: 'mech',
      entityId: 'm-app',
    })
    expect(log.map((r) => [r.field, r.after, r.source])).toEqual([
      ['currentHeat', 2, 'mediator-proposal'],
      ['name', 'Rook', 'test'],
    ])
    expect(log[1]?.before).not.toBe('Rook')
  })

  test('a crewmate reads it; somebody outside the Game does not', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedMech(t)
    await player.as.mutation(api.ops.apply, rename(gameId))
    const stranger = await makeUser(t, 'Stranger')

    const args = { entityType: 'mech' as const, entityId: 'm-app' }
    expect(await organizer.as.query(api.changeLog.forEntity, args)).toHaveLength(1)
    await expect(stranger.as.query(api.changeLog.forEntity, args)).rejects.toThrow(
      /Not a member of this Game/
    )
  })

  test("a Training Bay build's log is its owner's alone", async () => {
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

  test('past 100 rows, the newest 100 across every stream, newest first', async () => {
    const t = testConvex()
    const { organizer, player, gameId, mechId } = await seedMech(t)
    // Four streams: applied and proposed rows under both ids, their times
    // interleaved so no one stream holds the newest 100 on its own.
    await t.run(async (ctx) => {
      for (let ts = 1; ts <= 240; ts++) {
        await ctx.db.insert('changeLog', {
          gameId,
          entityType: 'mech',
          entityId: ts % 2 === 0 ? 'm-app' : mechId,
          ts,
          kind: 'manual',
          field: `f${ts}`,
          before: null,
          after: ts,
          source: 'live-sheet',
          actorId: organizer.userId,
          state: ts % 3 === 0 ? 'proposed' : 'applied',
        })
      }
    })

    const log = await player.as.query(api.changeLog.forEntity, {
      entityType: 'mech',
      entityId: 'm-app',
    })

    expect(log.map((r) => r.ts)).toEqual(Array.from({ length: 100 }, (_, i) => 240 - i))
  })

  test('ownership changes are named by the app id too', async () => {
    const t = testConvex()
    const { player, mechId } = await seedMech(t)
    await player.as.mutation(api.ownership.unassign, { table: 'mechs', entityId: mechId })

    const log = await player.as.query(api.changeLog.forEntity, {
      entityType: 'mech',
      entityId: 'm-app',
    })
    expect(log.map((r) => r.field)).toContain('ownerId')
  })
})
