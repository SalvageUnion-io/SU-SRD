import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { Ctx, User } from './fixtures'
import { addMech, addPilot, makeUser, mechBody, moveOwnable, seedTable } from './fixtures'
import { testConvex } from './harness'

/**
 * Seats (ADR-038 §2): each pilot's play state in a Game.
 *
 * The properties worth the most are who may write a seat (only whoever may
 * write the pilot, and the mech too when boarding), and that no path that
 * removes a pilot, a mech or a Game leaves a seat pointing at nothing.
 */

async function seatOf(user: User, gameId: Id<'games'>, pilotId: string) {
  const seats = await user.as.query(api.seats.forGame, { gameId })
  return seats.find((s) => s.pilotId === pilotId)
}

async function seatRows(t: Ctx) {
  return await t.run(async (ctx) => await ctx.db.query('seats').collect())
}

async function serverId(t: Ctx, table: 'pilots' | 'mechs', appId: string): Promise<string> {
  const row = await t.run(
    async (ctx) =>
      await ctx.db
        .query(table)
        .withIndex('by_app_id', (q) => q.eq('appId', appId))
        .first()
  )
  if (row === null) throw new Error(`no ${table} row for ${appId}`)
  return row._id
}

/** A table where the player owns pilot `p1` and mech `m1`, both in the Game. */
async function seatedTable(t: Ctx) {
  const table = await seedTable(t)
  await addPilot(table.player, 'p1', table.gameId)
  await addMech(table.player, 'm1', table.gameId)
  return table
}

describe('reading seats', () => {
  test('a pilot with no row reads as on foot, at Close, with nothing switched on', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    expect(await seatOf(player, gameId, 'p1')).toEqual({
      pilotId: 'p1',
      mount: { kind: 'foot' },
      range: 'Close',
      activeEffects: [],
      resolving: null,
      updatedAt: null,
    })
    // Reading creates nothing; rows are created on the first write.
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('every member reads every seat', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seatedTable(t)
    await player.as.mutation(api.seats.setRange, { gameId, pilotId: 'p1', range: 'Long' })
    expect((await seatOf(organizer, gameId, 'p1'))?.range).toBe('Long')
  })

  test('a non-member cannot read them', async () => {
    const t = testConvex()
    const { gameId } = await seatedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await expect(stranger.as.query(api.seats.forGame, { gameId })).rejects.toThrow(/not a member/i)
  })
})

describe('writing a seat', () => {
  test('board, set range, toggle an effect, then dismount', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    const seat = { gameId, pilotId: 'p1' }

    await player.as.mutation(api.seats.board, { ...seat, mechId: 'm1' })
    await player.as.mutation(api.seats.setRange, { ...seat, range: 'Medium' })
    await player.as.mutation(api.seats.toggleEffect, { ...seat, ref: 'abilities:beefcake' })
    let read = await seatOf(player, gameId, 'p1')
    expect(read?.mount).toEqual({ kind: 'boarded', mechId: 'm1' })
    expect(read?.range).toBe('Medium')
    expect(read?.activeEffects).toEqual(['abilities:beefcake'])

    await player.as.mutation(api.seats.toggleEffect, { ...seat, ref: 'abilities:beefcake' })
    await player.as.mutation(api.seats.dismount, seat)
    read = await seatOf(player, gameId, 'p1')
    expect(read?.mount).toEqual({ kind: 'foot' })
    expect(read?.activeEffects).toEqual([])
    // One row per pilot, however many writes.
    expect(await seatRows(t)).toHaveLength(1)
  })

  test('eject leaves the pilot on foot', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    await player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm1' })
    await player.as.mutation(api.seats.eject, { gameId, pilotId: 'p1' })
    expect((await seatOf(player, gameId, 'p1'))?.mount).toEqual({ kind: 'foot' })
  })

  test('boarding never assigns the mech to the pilot', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    await player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm1' })
    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links.filter((l) => l.type === 'mech-to-pilot')).toHaveLength(0)
  })

  test('a spare is boarded only once it is claimed, and claiming assigns nothing', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seatedTable(t)
    // The organizer offers a mech to the crew: an unclaimed spare in the Game.
    await addMech(organizer, 'm-spare', gameId)
    const entityId = await serverId(t, 'mechs', 'm-spare')
    await organizer.as.mutation(api.ownership.release, { table: 'mechs', entityId })
    const seat = { gameId, pilotId: 'p1', mechId: 'm-spare' }

    // The seat first would be refused: the Board menu claims, then boards.
    await expect(player.as.mutation(api.seats.board, seat)).rejects.toThrow(/unclaimed/i)
    expect(await seatRows(t)).toHaveLength(0)

    await player.as.mutation(api.ownership.claim, { table: 'mechs', entityId })
    await player.as.mutation(api.seats.board, seat)
    expect((await seatOf(player, gameId, 'p1'))?.mount).toEqual({
      kind: 'boarded',
      mechId: 'm-spare',
    })
    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links.filter((l) => l.type === 'mech-to-pilot')).toHaveLength(0)
  })

  test('one member runs two seats', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    await addPilot(player, 'p2', gameId)
    await addMech(player, 'm2', gameId)

    await player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm1' })
    await player.as.mutation(api.seats.board, { gameId, pilotId: 'p2', mechId: 'm2' })
    await player.as.mutation(api.seats.setRange, { gameId, pilotId: 'p2', range: 'Far' })

    expect((await seatOf(player, gameId, 'p1'))?.mount).toEqual({ kind: 'boarded', mechId: 'm1' })
    expect(await seatOf(player, gameId, 'p2')).toMatchObject({
      mount: { kind: 'boarded', mechId: 'm2' },
      range: 'Far',
    })
  })
})

describe('the resolve in progress (plan §8 A6)', () => {
  const crush = { ref: 'system:crush', name: 'Crush', activated: false, applied: false }

  test('each step replaces the last, and the crew reads it live', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seatedTable(t)
    const seat = { gameId, pilotId: 'p1' }

    await player.as.mutation(api.seats.setResolving, { ...seat, resolving: crush })
    expect((await seatOf(organizer, gameId, 'p1'))?.resolving).toEqual(crush)

    const rolled = { ...crush, activated: true, roll: { roll: 14, band: 'success' as const } }
    await player.as.mutation(api.seats.setResolving, { ...seat, resolving: rolled })
    // What a second client, or this one after a reload, reads back.
    expect((await seatOf(organizer, gameId, 'p1'))?.resolving).toEqual(rolled)

    await player.as.mutation(api.seats.clearResolving, seat)
    expect((await seatOf(organizer, gameId, 'p1'))?.resolving).toBeNull()
    expect((await seatRows(t))[0]?.resolving).toBeUndefined()
  })

  test('a change of mount ends the resolve; re-boarding the same mech does not', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    const seat = { gameId, pilotId: 'p1' }
    await player.as.mutation(api.seats.board, { ...seat, mechId: 'm1' })
    await player.as.mutation(api.seats.setResolving, { ...seat, resolving: crush })

    await player.as.mutation(api.seats.board, { ...seat, mechId: 'm1' })
    expect((await seatOf(player, gameId, 'p1'))?.resolving).toEqual(crush)

    await player.as.mutation(api.seats.dismount, seat)
    expect((await seatOf(player, gameId, 'p1'))?.resolving).toBeNull()

    await player.as.mutation(api.seats.setResolving, { ...seat, resolving: crush })
    await player.as.mutation(api.seats.board, { ...seat, mechId: 'm1' })
    expect((await seatOf(player, gameId, 'p1'))?.resolving).toBeNull()
  })

  test('losing the boarded mech ends the resolve', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    const seat = { gameId, pilotId: 'p1' }
    await player.as.mutation(api.seats.board, { ...seat, mechId: 'm1' })
    await player.as.mutation(api.seats.setResolving, { ...seat, resolving: crush })
    await player.as.mutation(api.entities.removeByAppId, { table: 'mechs', appId: 'm1' })
    expect(await seatOf(player, gameId, 'p1')).toMatchObject({
      mount: { kind: 'foot' },
      resolving: null,
    })
  })

  test("nobody else writes a pilot's resolve, the Mediator included", async () => {
    const t = testConvex()
    const { organizer, gameId } = await seatedTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    const seat = { gameId, pilotId: 'p1' }
    await expect(
      organizer.as.mutation(api.seats.setResolving, { ...seat, resolving: crush })
    ).rejects.toThrow(/another player's entity/i)
    await expect(organizer.as.mutation(api.seats.clearResolving, seat)).rejects.toThrow(
      /another player's entity/i
    )
    const stranger = await makeUser(t, 'Stranger')
    await expect(stranger.as.mutation(api.seats.clearResolving, seat)).rejects.toThrow(
      /not a member/i
    )
    expect(await seatRows(t)).toHaveLength(0)
  })
})

describe('refusals', () => {
  test('a non-member cannot write a seat', async () => {
    const t = testConvex()
    const { gameId } = await seatedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    await expect(
      stranger.as.mutation(api.seats.setRange, { gameId, pilotId: 'p1', range: 'Far' })
    ).rejects.toThrow(/not a member/i)
  })

  test("a member cannot write another player's seat, the Mediator included", async () => {
    const t = testConvex()
    const { organizer, gameId } = await seatedTable(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    const seat = { gameId, pilotId: 'p1' }
    const writes = [
      () => organizer.as.mutation(api.seats.setRange, { ...seat, range: 'Far' }),
      () => organizer.as.mutation(api.seats.toggleEffect, { ...seat, ref: 'x' }),
      () => organizer.as.mutation(api.seats.dismount, seat),
      () => organizer.as.mutation(api.seats.eject, seat),
      () => organizer.as.mutation(api.seats.board, { ...seat, mechId: 'm1' }),
    ]
    for (const write of writes) {
      await expect(write()).rejects.toThrow(/another player's entity/i)
    }
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('a pilot outside the Game has no seat in it', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    await addPilot(player, 'shelf-pilot', null)
    await expect(
      player.as.mutation(api.seats.setRange, { gameId, pilotId: 'shelf-pilot', range: 'Far' })
    ).rejects.toThrow(/not in this game/i)
  })

  test("a pilot cannot board another player's mech", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seatedTable(t)
    await addMech(organizer, 'm-org', gameId)
    await expect(
      player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm-org' })
    ).rejects.toThrow(/another player's entity/i)
  })

  test('a mech outside the Game cannot be boarded', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    await addMech(player, 'm-shelf', null)
    await expect(
      player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm-shelf' })
    ).rejects.toThrow(/not in this game/i)
  })

  test('a destroyed mech cannot be boarded', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'mechs',
      appId: 'm1',
      gameId,
      body: { ...mechBody({ id: 'm1', gameId }), destroyed: true },
      expectedUpdatedAt: null,
    })
    await expect(
      player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm1' })
    ).rejects.toThrow(/destroyed/i)
  })

  test('a mech another seat is boarded in cannot be boarded', async () => {
    const t = testConvex()
    const { player, gameId } = await seatedTable(t)
    await addPilot(player, 'p2', gameId)
    await player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm1' })
    await expect(
      player.as.mutation(api.seats.board, { gameId, pilotId: 'p2', mechId: 'm1' })
    ).rejects.toThrow(/already aboard/i)
    // Re-boarding the mech you are already in is not a conflict with yourself.
    await player.as.mutation(api.seats.board, { gameId, pilotId: 'p1', mechId: 'm1' })
  })
})

describe('cleanup', () => {
  async function boarded(t: Ctx) {
    const table = await seatedTable(t)
    await table.player.as.mutation(api.seats.board, {
      gameId: table.gameId,
      pilotId: 'p1',
      mechId: 'm1',
    })
    return table
  }

  test('deleting a pilot by app id deletes its seat', async () => {
    const t = testConvex()
    const { player } = await boarded(t)
    await player.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'p1' })
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('deleting a pilot by server id deletes its seat', async () => {
    const t = testConvex()
    const { player } = await boarded(t)
    const entityId = await serverId(t, 'pilots', 'p1')
    await player.as.mutation(api.entities.remove, { table: 'pilots', entityId })
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('moving a pilot out of the Game deletes its seat there', async () => {
    const t = testConvex()
    const { player } = await boarded(t)
    await moveOwnable(player, 'pilots', 'p1', null)
    expect(await seatRows(t)).toHaveLength(0)
  })

  test('deleting the boarded mech leaves the pilot on foot', async () => {
    const t = testConvex()
    const { player, gameId } = await boarded(t)
    await player.as.mutation(api.entities.removeByAppId, { table: 'mechs', appId: 'm1' })
    expect((await seatOf(player, gameId, 'p1'))?.mount).toEqual({ kind: 'foot' })
  })

  test('deleting the boarded mech by server id leaves the pilot on foot', async () => {
    const t = testConvex()
    const { player, gameId } = await boarded(t)
    const entityId = await serverId(t, 'mechs', 'm1')
    await player.as.mutation(api.entities.remove, { table: 'mechs', entityId })
    expect((await seatOf(player, gameId, 'p1'))?.mount).toEqual({ kind: 'foot' })
  })

  test('moving the boarded mech out of the Game leaves the pilot on foot', async () => {
    const t = testConvex()
    const { player, gameId } = await boarded(t)
    await moveOwnable(player, 'mechs', 'm1', null)
    expect((await seatOf(player, gameId, 'p1'))?.mount).toEqual({ kind: 'foot' })
  })

  test('destroying the Game deletes its seats and its Downtime row', async () => {
    const t = testConvex()
    const { organizer, gameId } = await boarded(t)
    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: organizer.userId,
      mediator: true,
    })
    await organizer.as.mutation(api.downtime.begin, { gameId })

    await organizer.as.mutation(api.games.destroy, { gameId })

    expect(await seatRows(t)).toHaveLength(0)
    expect(await t.run(async (ctx) => await ctx.db.query('downtime').collect())).toHaveLength(0)
  })

  test("deleting an account deletes its pilots' seats and unboards its mechs", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await boarded(t)
    // A crewmate's seat, which the player's departure must not touch.
    await addPilot(organizer, 'p-org', gameId)
    await organizer.as.mutation(api.seats.setRange, { gameId, pilotId: 'p-org', range: 'Far' })

    await player.as.mutation(api.account.deleteAccount, {})

    const rows = await seatRows(t)
    expect(rows.map((r) => r.pilotId)).toEqual(['p-org'])
  })

  test('a deleted mech of a departing account leaves a crewmate on foot', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seatedTable(t)
    // Boarding needs write access to the mech, so no mutation puts a crewmate
    // aboard the player's mech; seed the row directly to cover a mech whose
    // ownership changed after its boarder sat down.
    await addPilot(organizer, 'p-org', gameId)
    await t.run(async (ctx) => {
      await ctx.db.insert('seats', {
        gameId,
        pilotId: 'p-org',
        mount: { kind: 'boarded', mechId: 'm1' },
        range: 'Close',
        activeEffects: [],
        updatedAt: 0,
      })
    })

    await player.as.mutation(api.account.deleteAccount, {})

    expect((await seatOf(organizer, gameId, 'p-org'))?.mount).toEqual({ kind: 'foot' })
  })

  test("the last member's account deletion deletes the Game's play state", async () => {
    const t = testConvex()
    const solo = await makeUser(t, 'Solo')
    const gameId = await solo.as.mutation(api.games.create, { name: 'Lonely' })
    await solo.as.mutation(api.games.setMediator, { gameId, userId: solo.userId, mediator: true })
    await addPilot(solo, 'ps', gameId)
    await solo.as.mutation(api.seats.setRange, { gameId, pilotId: 'ps', range: 'Long' })
    await solo.as.mutation(api.downtime.begin, { gameId })

    await solo.as.mutation(api.account.deleteAccount, {})

    expect(await seatRows(t)).toHaveLength(0)
    expect(await t.run(async (ctx) => await ctx.db.query('downtime').collect())).toHaveLength(0)
  })
})
